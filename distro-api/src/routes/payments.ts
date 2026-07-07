import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin } from '../middleware/auth';
import { withTransaction } from '../lib/transaction';
import { webhookLimiter } from '../middleware/rateLimiter';
import { sendEmail, render } from '../lib/email';
import { PaymentConfirmEmail } from '../emails/PaymentConfirmEmail';

const router = Router();

/** Safely extract a scalar string from req.query or req.params. */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

function esewaSignature(message: string): string {
  return crypto
    .createHmac('sha256', process.env.ESEWA_SECRET_KEY!)
    .update(message)
    .digest('base64');
}

// ─── GET /api/payments/webhook/esewa — eSewa redirect callback ───────────────
// eSewa redirects buyer to success URL with ?data=<base64-encoded-JSON>
router.get('/webhook/esewa', webhookLimiter, async (req: Request, res: Response): Promise<void> => {
  const rawData = qs(req.query.data as string | string[] | undefined);
  if (!rawData) {
    res.status(400).json({ error: 'Missing data param' });
    return;
  }

  let payload: Record<string, string>;
  try {
    payload = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
  } catch {
    res.status(400).json({ error: 'Invalid base64 data' });
    return;
  }

  // Verify HMAC signature
  const signedFields: string[] = (payload.signed_field_names ?? '').split(',');
  const signMsg = signedFields.map((f) => `${f}=${payload[f]}`).join(',');
  const expected = esewaSignature(signMsg);

  if (expected !== payload.signature) {
    res.status(400).json({ error: 'Signature mismatch' });
    return;
  }

  if (payload.status !== 'COMPLETE') {
    res.status(200).json({ message: 'Payment not complete, ignored' });
    return;
  }

  const transactionUuid = payload.transaction_uuid;

  const order = await prisma.order.findUnique({
    where:   { id: transactionUuid },
    include: { buyer: { select: { phone: true, email: true, id: true, storeName: true } } },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Idempotency: already paid → return 200 without duplicate writes
  if (order.paymentStatus === 'PAID') {
    res.status(200).json({ message: 'Already processed' });
    return;
  }

  // The gateway-confirmed amount must match the order total — otherwise a
  // buyer could pay for a cheaper transaction and get the order marked PAID.
  const paidAmount = Number(String(payload.total_amount ?? '').replace(/,/g, ''));
  if (paidAmount !== order.total) {
    console.error(
      `[ESEWA] Amount mismatch for ${order.orderNumber}: paid ${paidAmount}, expected ${order.total}`,
    );
    await prisma.payment.create({
      data: {
        orderId:     order.id,
        method:      'ESEWA',
        status:      'UNPAID',
        amount:      Number.isFinite(paidAmount) ? paidAmount : 0,
        reference:   payload.transaction_code ?? transactionUuid,
        rawResponse: payload as any,
      },
    });
    res.status(400).json({ error: 'Amount mismatch' });
    return;
  }

  await withTransaction(async (tx) => {
    // Lock the buyer's profile row — serializes ledger + credit writes.
    await tx.$queryRaw`SELECT id FROM Profile WHERE id = ${order.buyerId} FOR UPDATE`;

    await tx.order.update({
      where: { id: order.id },
      data:  { paymentStatus: 'PAID' },
    });

    await tx.payment.create({
      data: {
        orderId:     order.id,
        method:      'ESEWA',
        status:      'PAID',
        amount:      order.total,
        reference:   payload.transaction_code ?? transactionUuid,
        rawResponse: payload as any,
      },
    });

    // Locking read so we see the latest committed balance, not this
    // transaction's snapshot.
    const lastRows = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT balance FROM Ledger WHERE buyerId = ${order.buyerId}
      ORDER BY createdAt DESC, id DESC LIMIT 1 FOR UPDATE`;
    const newBalance = Number(lastRows[0]?.balance ?? 0) - order.total;

    await tx.ledger.create({
      data: {
        buyerId: order.buyerId,
        type:    'CREDIT',
        amount:  order.total,
        balance: newBalance,
        note:    `eSewa payment for ${order.orderNumber}`,
        orderId: order.id,
      },
    });

    await tx.profile.update({
      where: { id: order.buyerId },
      data:  { creditUsed: { decrement: order.total } },
    });
  });

  // Non-blocking email confirmation
  if (order.buyer.email) {
    void (async () => {
      try {
        const html = await render(PaymentConfirmEmail({
          orderNumber: order.orderNumber,
          storeName:   order.buyer.storeName ?? order.buyer.phone,
          amount:      order.total,
          method:      'eSewa',
          reference:   payload.transaction_uuid,
        }));
        await sendEmail(order.buyer.email!, `Payment Confirmed — ${order.orderNumber}`, html, 'payment_confirm');
      } catch (e) {
        console.error('[EMAIL] Payment confirm (eSewa) failed:', e);
      }
    })();
  }

  res.status(200).json({ message: 'Payment recorded' });
});

// ─── POST /api/payments/webhook/khalti — Khalti server webhook ───────────────
router.post('/webhook/khalti', webhookLimiter, async (req: Request, res: Response): Promise<void> => {
  const { pidx } = req.body as { pidx?: string };

  if (!pidx) {
    res.status(400).json({ error: 'Missing pidx' });
    return;
  }

  // Verify with Khalti lookup API
  let khaltiData: Record<string, any>;
  try {
    const lookupRes = await axios.post(
      'https://a.khalti.com/api/v2/epayment/lookup/',
      { pidx },
      {
        headers: {
          Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    khaltiData = lookupRes.data;
  } catch (err: any) {
    res.status(400).json({ error: 'Khalti lookup failed', detail: err?.response?.data });
    return;
  }

  if (khaltiData.status !== 'Completed') {
    res.status(200).json({ message: 'Payment not completed, ignored' });
    return;
  }

  const orderId = khaltiData.purchase_order_id as string;

  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: { buyer: { select: { phone: true, email: true, id: true, storeName: true } } },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  // Idempotency
  if (order.paymentStatus === 'PAID') {
    res.status(200).json({ message: 'Already processed' });
    return;
  }

  // Khalti amounts are in paisa — must match the order total exactly.
  if (khaltiData.total_amount !== Math.round(order.total * 100)) {
    console.error(
      `[KHALTI] Amount mismatch for ${order.orderNumber}: paid ${khaltiData.total_amount} paisa, expected ${Math.round(order.total * 100)}`,
    );
    await prisma.payment.create({
      data: {
        orderId:     order.id,
        method:      'KHALTI',
        status:      'UNPAID',
        amount:      Number(khaltiData.total_amount) / 100 || 0,
        reference:   pidx,
        rawResponse: khaltiData as any,
      },
    });
    res.status(400).json({ error: 'Amount mismatch' });
    return;
  }

  await withTransaction(async (tx) => {
    // Lock the buyer's profile row — serializes ledger + credit writes.
    await tx.$queryRaw`SELECT id FROM Profile WHERE id = ${order.buyerId} FOR UPDATE`;

    await tx.order.update({
      where: { id: order.id },
      data:  { paymentStatus: 'PAID' },
    });

    await tx.payment.create({
      data: {
        orderId:     order.id,
        method:      'KHALTI',
        status:      'PAID',
        amount:      order.total,
        reference:   pidx,
        rawResponse: khaltiData as any,
      },
    });

    // Locking read so we see the latest committed balance, not this
    // transaction's snapshot.
    const lastRows = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT balance FROM Ledger WHERE buyerId = ${order.buyerId}
      ORDER BY createdAt DESC, id DESC LIMIT 1 FOR UPDATE`;
    const newBalance = Number(lastRows[0]?.balance ?? 0) - order.total;

    await tx.ledger.create({
      data: {
        buyerId: order.buyerId,
        type:    'CREDIT',
        amount:  order.total,
        balance: newBalance,
        note:    `Khalti payment for ${order.orderNumber}`,
        orderId: order.id,
      },
    });

    await tx.profile.update({
      where: { id: order.buyerId },
      data:  { creditUsed: { decrement: order.total } },
    });
  });

  // Non-blocking email confirmation
  if (order.buyer.email) {
    void (async () => {
      try {
        const html = await render(PaymentConfirmEmail({
          orderNumber: order.orderNumber,
          storeName:   order.buyer.storeName ?? order.buyer.phone,
          amount:      order.total,
          method:      'Khalti',
          reference:   pidx,
        }));
        await sendEmail(order.buyer.email!, `Payment Confirmed — ${order.orderNumber}`, html, 'payment_confirm');
      } catch (e) {
        console.error('[EMAIL] Payment confirm (Khalti) failed:', e);
      }
    })();
  }

  res.status(200).json({ message: 'Payment recorded' });
});

// ─── GET /api/payments/:orderId — ADMIN ──────────────────────────────────────
router.get('/:orderId', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const orderId = qs(req.params.orderId)!;
  const payments = await prisma.payment.findMany({
    where:   { orderId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ payments });
});

export default router;
