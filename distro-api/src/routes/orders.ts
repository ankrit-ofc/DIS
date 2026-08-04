import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin, requireRole } from '../middleware/auth';
import { withTransaction } from '../lib/transaction';
import { reverseOrderEffects, canAdminCancel, refundOwedNote } from '../lib/orderReversal';
import { sendEmail, render } from '../lib/email';
import { dispatchNotification, orderConfirmMessage, statusUpdateMessage, sendExpoPush, orderStatusPush } from '../lib/notifications';
import { OrderConfirmEmail } from '../emails/OrderConfirmEmail';
import { OrderStatusEmail } from '../emails/OrderStatusEmail';
import { InvoiceEmail } from '../emails/InvoiceEmail';
import { NewOrderAdminEmail } from '../emails/NewOrderAdminEmail';
import { generateInvoicePdf } from '../services/invoice';
import { maxOrderQty, moqUnits, piecesPerSellUnit, stockStatus, unitLabel, unitPrice } from '../lib/stock';
import { validateActiveDistrict } from '../lib/districts';

const router = Router();

/** Safely extract a scalar string from req.query or req.params (Express 5 types as string | string[]). */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED',
] as const;

const MIN_ORDER_VALUE = 10000;

class OrderError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    /** Extra JSON fields merged into the error response (e.g. structured 409s). */
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

interface InsufficientStockItem {
  productId: string;
  requested: number;
  available: number;
}

function insufficientStockError(items: InsufficientStockItem[]): OrderError {
  return new OrderError(409, 'Insufficient stock for some items', {
    code: 'INSUFFICIENT_STOCK',
    items,
  });
}

function esewaSignature(message: string): string {
  return crypto
    .createHmac('sha256', process.env.ESEWA_SECRET_KEY!)
    .update(message)
    .digest('base64');
}

// ─── POST /api/orders — BUYER for self; SALES/ADMIN may order for a buyer ─────
router.post(
  '/',
  requireAuth,
  requireRole('BUYER', 'SALES', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    const operator = (req as any).profile as {
      id: string; role: string; phone: string; email?: string | null;
      storeName?: string | null; address?: string | null; district?: string | null;
    };

    const {
      items,
      buyerId,
      deliveryDistrict,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      paymentMethod,
      notes,
    } = req.body as {
      items?: Array<{ productId: string; qty: number }>;
      buyerId?: string;
      deliveryDistrict?: string;
      deliveryAddress?: string;
      deliveryLat?: number;
      deliveryLng?: number;
      paymentMethod?: string;
      notes?: string;
    };

    // buyerId is honoured ONLY for SALES/ADMIN sessions — buyers always order
    // for themselves regardless of what the request claims.
    const onBehalf = (operator.role === 'SALES' || operator.role === 'ADMIN') && !!buyerId;
    if (operator.role === 'BUYER' && buyerId && buyerId !== operator.id) {
      res.status(403).json({ error: 'Buyers can only order for themselves' });
      return;
    }
    if ((operator.role === 'SALES' || operator.role === 'ADMIN') && !buyerId) {
      res.status(400).json({ error: 'buyerId is required when ordering on behalf of a buyer' });
      return;
    }

    // All financial effects (ledger DEBIT, credit-limit check, creditUsed) go
    // against the BUYER's profile — the rep is just the operator.
    let buyer: {
      id: string; phone: string; email?: string | null; storeName?: string | null;
      address?: string | null;
    };
    if (onBehalf) {
      const target = await prisma.profile.findUnique({
        where: { id: buyerId },
        select: { id: true, phone: true, email: true, storeName: true, address: true, role: true, status: true },
      });
      if (!target || target.role !== 'BUYER') {
        res.status(400).json({ error: 'buyerId must reference a buyer account' });
        return;
      }
      if (target.status !== 'ACTIVE') {
        res.status(400).json({ error: 'Buyer account is not active' });
        return;
      }
      buyer = target;
    } else {
      buyer = operator as any;
    }

    // ── Idempotency ───────────────────────────────────────────────────────────
    // Reps work on patchy mobile data in shops, so "order committed, response
    // lost, rep retries" is routine rather than an edge case, and the cost is a
    // duplicate order against a real shop's credit line. The client mints one
    // key per checkout ATTEMPT and reuses it across retries; a fresh key per
    // request would make this a no-op. See docs/known-issues.md.
    const rawKey = req.header('Idempotency-Key')?.trim();
    if (rawKey !== undefined && (rawKey.length === 0 || rawKey.length > 64)) {
      res.status(400).json({ error: 'Idempotency-Key must be 1-64 characters' });
      return;
    }
    const idempotencyKey = rawKey || null;

    if (idempotencyKey) {
      // Fast path only. The unique index inside the transaction is the actual
      // guard — two simultaneous retries both miss this read.
      const prior = await prisma.order.findUnique({
        where:   { idempotencyKey },
        include: { items: true },
      });
      if (prior) {
        // A key is a bearer token for whatever order it created, so it must not
        // let one account read another's. Same key + different buyer is a
        // client bug or an attack, never a legitimate retry.
        if (prior.buyerId !== buyer.id) {
          res.status(409).json({ error: 'Idempotency-Key already used by another account' });
          return;
        }
        // Deliberately returns before the notification block below: a retry
        // must not re-send the shop's confirmation SMS and email.
        res.set('Idempotency-Replayed', 'true').status(200).json({ order: prior });
        return;
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }
    if (!deliveryDistrict || !deliveryAddress) {
      res.status(400).json({ error: 'deliveryDistrict and deliveryAddress are required' });
      return;
    }
    // Orders must ship to a served (active) district — client dropdowns filter
    // to these already, so a failure here means a stale or hand-crafted request.
    const districtError = await validateActiveDistrict(deliveryDistrict);
    if (districtError) {
      res.status(400).json({ error: districtError });
      return;
    }
    // CREDIT (pay-on-account) is only available in the field flow, where a
    // SALES rep or admin is placing the order.
    const allowedMethods = onBehalf ? ['COD', 'CREDIT'] : ['ESEWA', 'KHALTI', 'COD'];
    if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
      res.status(400).json({ error: `paymentMethod must be one of: ${allowedMethods.join(', ')}` });
      return;
    }

    let createdOrder: any;

    try {
      createdOrder = await withTransaction(async (tx) => {
        // 1. Validate all items — qty is in the product's sellUnit
        //    (pieces for PIECE products, cartons for CARTON products).
        const shortItems: InsufficientStockItem[] = [];
        for (const item of items) {
          if (!item.productId) {
            throw new OrderError(400, 'Each item requires productId');
          }
          if (
            item.qty == null ||
            !Number.isInteger(item.qty) ||
            item.qty < 1
          ) {
            throw new OrderError(400, 'Quantity must be a whole number of 1 or more');
          }
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) {
            throw new OrderError(400, `Product not found: ${item.productId}`);
          }
          if (!product.active) {
            throw new OrderError(400, `Product is not available: ${product.name}`);
          }
          const minQty = moqUnits(product);
          if (item.qty < minQty) {
            throw new OrderError(
              400,
              `Minimum order for "${product.name}" is ${minQty} ${unitLabel(product.sellUnit)}`,
            );
          }
          // stockQty is in pieces; ordering N sell-units consumes N × pieces-per-unit.
          const available = maxOrderQty(product);
          if (item.qty > available) {
            shortItems.push({ productId: product.id, requested: item.qty, available });
          }
        }
        if (shortItems.length > 0) {
          throw insufficientStockError(shortItems);
        }

        // 2. Delivery fee from District table
        const district    = await tx.district.findUnique({ where: { name: deliveryDistrict } });
        const deliveryFee = district?.deliveryFee ?? 0;

        // 3. Load products for price snapshot + subtotal
        const productIds = items.map((i) => i.productId);
        const products   = await tx.product.findMany({ where: { id: { in: productIds } } });
        const productMap = new Map(products.map((p) => [p.id, p]));

        let subtotal = 0;
        for (const item of items) {
          const p = productMap.get(item.productId)!;
          subtotal += unitPrice(p) * item.qty;
        }

        if (subtotal < MIN_ORDER_VALUE) {
          throw new OrderError(
            400,
            `Minimum order is Rs ${MIN_ORDER_VALUE.toLocaleString('en-IN')}. Your subtotal is Rs ${subtotal.toLocaleString('en-IN')}.`,
          );
        }

        const vatRate = parseFloat(process.env.VAT_RATE ?? '0.13');
        const vat = Number((subtotal * vatRate).toFixed(2));
        const total = Number((subtotal + vat + deliveryFee).toFixed(2));

        // 3b. Lock the buyer's profile row — serializes ledger + credit writes
        // for this buyer against concurrent orders/cancels/payment webhooks.
        // NOTE: must be a locking read that also RETURNS the fresh values;
        // under REPEATABLE READ a later plain SELECT would still see the
        // transaction's pre-lock snapshot.
        const lockedBuyer = await tx.$queryRaw<Array<{ creditLimit: number; creditUsed: number }>>`
          SELECT creditLimit, creditUsed FROM Profile WHERE id = ${buyer.id} FOR UPDATE`;

        // 3c. Enforce credit limit (0 = no limit set) using fresh, locked values.
        const freshBuyer = lockedBuyer[0];
        if (
          freshBuyer &&
          freshBuyer.creditLimit > 0 &&
          Number(freshBuyer.creditUsed) + total > Number(freshBuyer.creditLimit)
        ) {
          throw new OrderError(400, 'Credit limit exceeded');
        }

        // 4. Create Order
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId: buyer.id,
            salesRepId: onBehalf ? operator.id : null,
            paymentMethod: paymentMethod as any,
            subtotal,
            vat,
            deliveryFee,
            total,
            deliveryDistrict,
            deliveryAddress,
            ...(deliveryLat != null && { deliveryLat }),
            ...(deliveryLng != null && { deliveryLng }),
            notes: notes ?? null,
            idempotencyKey,
          },
        });

        // 5. Create OrderItem rows — price/qty in the product's sellUnit,
        //    with the unit snapshotted alongside the price.
        for (const item of items) {
          const p = productMap.get(item.productId)!;
          const perUnit = unitPrice(p);
          await tx.orderItem.create({
            data: {
              orderId:         order.id,
              productId:       item.productId,
              name:            p.name,
              unit:            p.sellUnit,
              price:           perUnit,
              qty:             item.qty,
              piecesPerCarton: p.sellUnit === 'CARTON' ? piecesPerSellUnit(p) : null,
              total:           Number((perUnit * item.qty).toFixed(2)),
            },
          });
        }

        // 6. Decrement stockQty (in pieces) for each product — conditional so
        // two concurrent orders can't both pass the earlier check and drive
        // stock negative; count === 0 means someone else took the stock first.
        for (const item of items) {
          const p = productMap.get(item.productId)!;
          const piecesNeeded = item.qty * piecesPerSellUnit(p);
          const r = await tx.product.updateMany({
            where: { id: item.productId, stockQty: { gte: piecesNeeded } },
            data:  { stockQty: { decrement: piecesNeeded } },
          });
          if (r.count === 0) {
            // Someone else took the stock between our check and this write —
            // report fresh availability so the client can offer "Update to N".
            // Must be a locking read: under REPEATABLE READ a plain SELECT
            // would return this transaction's stale pre-race snapshot.
            const freshRows = await tx.$queryRaw<Array<{ stockQty: number }>>`
              SELECT stockQty FROM Product WHERE id = ${item.productId} FOR UPDATE`;
            const freshStock = Number(freshRows[0]?.stockQty ?? 0);
            throw insufficientStockError([{
              productId: item.productId,
              requested: item.qty,
              available: Math.max(0, Math.floor(freshStock / piecesPerSellUnit(p))),
            }]);
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type:      'OUT',
              qty:       piecesNeeded,
              reason:    `Order ${orderNumber}`,
            },
          });
        }

        // 7. Create Ledger DEBIT entry — locking read so we see the latest
        // committed balance, not this transaction's snapshot.
        const lastRows = await tx.$queryRaw<Array<{ balance: number }>>`
          SELECT balance FROM Ledger WHERE buyerId = ${buyer.id}
          ORDER BY createdAt DESC, id DESC LIMIT 1 FOR UPDATE`;
        const newBalance = Number(lastRows[0]?.balance ?? 0) + total;

        await tx.ledger.create({
          data: {
            buyerId: buyer.id,
            type:    'DEBIT',
            amount:  total,
            balance: newBalance,
            note:    `Order ${orderNumber}`,
            orderId: order.id,
          },
        });

        // 8. Update Profile.creditUsed
        await tx.profile.update({
          where: { id: buyer.id },
          data:  { creditUsed: { increment: total } },
        });

        // Re-fetch with items for response
        return tx.order.findUnique({
          where:   { id: order.id },
          include: { items: true },
        });
      });
    } catch (err) {
      if (err instanceof OrderError) {
        res.status(err.statusCode).json({ error: err.message, ...(err.body ?? {}) });
        return;
      }
      // Two retries raced past the pre-flight read and this one lost the unique
      // index. The winner's order is the correct answer, so this is a success,
      // not an error — the whole point is that the rep never sees a failure for
      // an order that did commit.
      if (
        idempotencyKey &&
        (err as { code?: string }).code === 'P2002' &&
        String((err as any).meta?.target ?? '').includes('idempotencyKey')
      ) {
        const winner = await prisma.order.findUnique({
          where:   { idempotencyKey },
          include: { items: true },
        });
        if (winner && winner.buyerId === buyer.id) {
          res.set('Idempotency-Replayed', 'true').status(200).json({ order: winner });
          return;
        }
      }
      console.error('[ORDER] Unhandled error creating order:', err);
      res.status(500).json({ error: (err as Error).message || 'Internal server error' });
      return;
    }

    // ── After transaction commits ─────────────────────────────────────────────
    // Legacy accounts with no saved address: the first successful order's
    // delivery details become the profile's saved address, so the next
    // checkout pre-fills instead of re-asking. Best-effort — never fails the order.
    if (!buyer.address?.trim()) {
      void prisma.profile
        .update({
          where: { id: buyer.id },
          data: { address: deliveryAddress, district: deliveryDistrict },
        })
        .catch((e) => console.error('[ORDER] Address backfill failed:', e));
    }

    // Fire-and-forget notifications
    // Channel comes from notificationPolicy.ts — 'email' today, so this no-ops
    // and the confirmation email below is the buyer's record of the order.
    void dispatchNotification('order_confirmation', {
      phone: buyer.phone,
      profileId: buyer.id,
      message: orderConfirmMessage(createdOrder.orderNumber, createdOrder.total),
    });

    const emailItems = (createdOrder.items ?? []).map((row: { name: string; qty: number; price: number; total?: number }) => ({
      name: row.name,
      qty: row.qty,
      price: row.price,
      total: row.total ?? row.price * row.qty,
    }));

    // Buyer confirmation email
    if (buyer.email) {
      void (async () => {
        try {
          const html = await render(OrderConfirmEmail({
            orderNumber:      createdOrder.orderNumber,
            storeName:        (buyer as any).storeName ?? buyer.phone,
            items:            emailItems,
            subtotal:         createdOrder.subtotal,
            deliveryFee:      createdOrder.deliveryFee,
            total:            createdOrder.total,
            deliveryDistrict: createdOrder.deliveryDistrict ?? '',
            paymentMethod:    createdOrder.paymentMethod,
          }));
          await sendEmail(buyer.email!, `Order Confirmed — ${createdOrder.orderNumber}`, html, 'order_confirm');
        } catch (e) {
          console.error('[EMAIL] Order confirm pipeline failed:', e);
        }
      })();
    }

    // Admin new-order notification
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (adminEmail) {
      void (async () => {
        try {
          const html = await render(NewOrderAdminEmail({
            orderNumber:      createdOrder.orderNumber,
            storeName:        (buyer as any).storeName ?? buyer.phone,
            phone:            buyer.phone,
            items:            emailItems,
            subtotal:         createdOrder.subtotal,
            deliveryFee:      createdOrder.deliveryFee,
            total:            createdOrder.total,
            deliveryDistrict: createdOrder.deliveryDistrict ?? '',
            deliveryAddress:  createdOrder.deliveryAddress ?? '',
            paymentMethod:    createdOrder.paymentMethod,
          }));
          await sendEmail(adminEmail, `New Order — ${createdOrder.orderNumber}`, html, 'new_order_admin');
        } catch (e) {
          console.error('[EMAIL] Admin new-order notification failed:', e);
        }
      })();
    }

    res.status(201).json({ order: createdOrder });
  },
);

// ─── GET /api/orders — BUYER sees own, SALES sees own reps' orders, ADMIN all ─
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const profile     = (req as any).profile as { id: string; role: string };
  const isAdminUser = profile.role === 'ADMIN';
  const isSalesUser = profile.role === 'SALES';

  const status   = qs(req.query.status   as string | string[] | undefined);
  const search   = qs(req.query.search   as string | string[] | undefined);
  const from     = qs(req.query.from     as string | string[] | undefined);
  const to       = qs(req.query.to       as string | string[] | undefined);
  const page     = qs(req.query.page     as string | string[] | undefined);
  const limit    = qs(req.query.limit    as string | string[] | undefined);
  const buyerId  = qs(req.query.buyerId  as string | string[] | undefined);

  const pageNum  = Math.max(1, parseInt(page  ?? '1')  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20') || 20));
  const skip     = (pageNum - 1) * limitNum;

  const where: Record<string, any> = {};
  if (isSalesUser) where.salesRepId = profile.id;
  else if (!isAdminUser) where.buyerId = profile.id;
  else if (buyerId) where.buyerId = buyerId;
  if (status)       where.status  = status;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { buyer: { storeName: { contains: search } } },
      { buyer: { phone:     { contains: search } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: {
        buyer: { select: { id: true, storeName: true, phone: true } },
        items: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ orders, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// ─── GET /api/orders/:id — full detail ────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const profile = (req as any).profile as { id: string; role: string };
  const id      = qs(req.params.id)!;

  const order = await prisma.order.findUnique({
    where:   { id },
    include: {
      buyer:    { select: { id: true, storeName: true, phone: true, email: true } },
      items:    true,
      payments: true,
      activity: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const isOwner    = order.buyerId === profile.id;
  const isRepOwner = profile.role === 'SALES' && order.salesRepId === profile.id;
  if (profile.role !== 'ADMIN' && !isOwner && !isRepOwner) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json({ order });
});

// ─── PATCH /api/orders/:id/status — ADMIN ────────────────────────────────────
router.patch(
  '/:id/status',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = qs(req.params.id)!;
    const { status, note } = req.body as { status?: string; note?: string };

    if (!status || !ORDER_STATUSES.includes(status as any)) {
      res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Cancelling has to undo the order's stock and credit effects, so it is not
    // an ordinary status write — see the transaction below. DELIVERED is out of
    // scope for cancellation: the goods are already at the shop.
    if (status === 'CANCELLED' && !canAdminCancel(order.status)) {
      res.status(400).json({
        error:
          order.status === 'DELIVERED'
            ? 'Delivered orders cannot be cancelled — process a return instead'
            : `Cannot cancel an order with status ${order.status}`,
      });
      return;
    }

    // Fetch buyer for notifications
    const buyer = await prisma.profile.findUnique({
      where:  { id: order.buyerId },
      // id is needed so dispatchNotification can reach push tokens if the
      // policy ever routes order events to push.
      select: { id: true, phone: true, email: true, storeName: true },
    });

    let updated;
    if (status === 'CANCELLED') {
      // A settled order's credit was already released by the payment webhook,
      // so reversing it again would drive creditUsed negative. Stock still
      // comes back, and the refund owed is recorded on the activity trail.
      const reverseCredit = order.paymentStatus !== 'PAID';

      updated = await withTransaction(async (tx) => {
        const upd = await tx.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
        const result = await reverseOrderEffects(tx, order, { reverseCredit });

        await tx.orderActivity.create({
          data: { orderId: id, status: 'CANCELLED', note: note ?? 'Cancelled by admin' },
        });
        if (result.refundOwed !== null) {
          await tx.orderActivity.create({
            data: {
              orderId: id,
              status: 'CANCELLED',
              note: refundOwedNote(result.refundOwed),
            },
          });
        }
        return upd;
      });
    } else {
      [updated] = await Promise.all([
        prisma.order.update({ where: { id }, data: { status: status as any } }),
        prisma.orderActivity.create({
          data: { orderId: id, status: status as any, note: note ?? null },
        }),
      ]);
    }

    // Non-blocking notifications
    if (buyer) {
      void dispatchNotification('order_status', {
        phone: buyer.phone,
        profileId: buyer.id,
        message: statusUpdateMessage(order.orderNumber, status),
      });
      if (buyer.email) {
        void (async () => {
          try {
            const html = await render(OrderStatusEmail({
              orderNumber: order.orderNumber,
              storeName:   buyer!.storeName ?? order.buyerId,
              newStatus:   status,
            }));
            await sendEmail(buyer!.email!, `Order Update — ${order.orderNumber}`, html, 'status_update');
          } catch (e) {
            console.error('[EMAIL] Status update pipeline failed:', e);
          }
        })();

      }
    }

    // Non-blocking Expo push to the buyer's registered devices
    void (async () => {
      try {
        const tokens = await prisma.pushToken.findMany({
          where:  { profileId: order.buyerId },
          select: { token: true },
        });
        if (tokens.length === 0) return;
        const { title, body } = orderStatusPush(order.orderNumber, status);
        await sendExpoPush(
          tokens.map((t) => ({
            to: t.token,
            title,
            body,
            sound: 'default' as const,
            channelId: 'orders',
            data: { orderId: order.id, orderNumber: order.orderNumber },
          })),
        );
      } catch (e) {
        console.error('[ExpoPush] status-change pipeline failed:', e);
      }
    })();

    // PDF invoice generation + email on CONFIRMED — runs regardless of buyer email
    if (status === 'CONFIRMED') {
      void (async () => {
        try {
          const invoice = await generateInvoicePdf(id);
          await prisma.order.update({
            where: { id },
            data: { invoicePdfPath: invoice.relativeUrl },
          });

          if (buyer?.email) {
            try {
              const greetingName = buyer.storeName ?? 'there';
              const html = `
                <div style="font-family: system-ui, sans-serif; color: #0D1120; max-width: 560px; margin: 0 auto;">
                  <h2 style="color: #1A4BDB;">Your DISTRO order is confirmed</h2>
                  <p>Hi ${greetingName},</p>
                  <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.
                  The PDF invoice is attached to this email for your records.</p>
                  <p>Thank you for ordering with DISTRO Nepal.</p>
                </div>
              `;
              await sendEmail(
                buyer.email,
                `Your DISTRO order ${order.orderNumber} is confirmed`,
                html,
                'invoice_confirmed',
                [{ filename: invoice.fileName, content: invoice.buffer }],
              );
              await prisma.order.update({
                where: { id },
                data: { invoiceEmailSent: true },
              });
            } catch (mailErr) {
              const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
              console.error(`[INVOICE EMAIL] order ${order.orderNumber} send failed: ${msg}`);
            }
          }
        } catch (pdfErr) {
          console.error(`[INVOICE PDF] order ${order.orderNumber} generation failed:`, pdfErr);
        }
      })();
    }

    res.json({ order: updated });
  },
);

// ─── PATCH /api/orders/bulk-status — ADMIN, update many in one call ──────────
router.patch(
  '/bulk-status',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { ids, status, note } = req.body as { ids?: string[]; status?: string; note?: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }
    if (!status || !ORDER_STATUSES.includes(status as any)) {
      res.status(400).json({ error: `status must be one of: ${ORDER_STATUSES.join(', ')}` });
      return;
    }

    const found = await prisma.order.findMany({
      where:   { id: { in: ids } },
      include: {
        items: true,
        buyer: { select: { id: true, phone: true, email: true, storeName: true } },
      },
    });

    if (found.length === 0) {
      res.status(404).json({ error: 'No matching orders found' });
      return;
    }

    // Bulk-cancelling stale orders is routine admin work, and it used to leak
    // stock and credit for every order in the batch — this was the likelier
    // source of historical damage than the single-order route.
    let orders = found;
    let skipped: Array<{ orderNumber: string; status: string }> = [];
    if (status === 'CANCELLED') {
      orders = found.filter((o) => canAdminCancel(o.status));
      skipped = found
        .filter((o) => !canAdminCancel(o.status))
        .map((o) => ({ orderNumber: o.orderNumber, status: o.status }));

      if (orders.length === 0) {
        res.status(400).json({
          error: 'None of the selected orders can be cancelled',
          skipped,
        });
        return;
      }
    }

    if (status === 'CANCELLED') {
      // One transaction per order rather than one for the batch: a single
      // un-reversible order must not roll back the rest, and each reversal
      // takes a row lock on its own buyer.
      for (const o of orders) {
        const reverseCredit = o.paymentStatus !== 'PAID';
        await withTransaction(async (tx) => {
          await tx.order.update({ where: { id: o.id }, data: { status: 'CANCELLED' } });
          const result = await reverseOrderEffects(tx, o, { reverseCredit });

          await tx.orderActivity.create({
            data: { orderId: o.id, status: 'CANCELLED', note: note ?? 'Cancelled by admin (bulk)' },
          });
          if (result.refundOwed !== null) {
            await tx.orderActivity.create({
              data: { orderId: o.id, status: 'CANCELLED', note: refundOwedNote(result.refundOwed) },
            });
          }
        });
      }
    } else {
      await prisma.$transaction([
        prisma.order.updateMany({
          where: { id: { in: orders.map((o) => o.id) } },
          data:  { status: status as any },
        }),
        ...orders.map((o) =>
          prisma.orderActivity.create({
            data: { orderId: o.id, status: status as any, note: note ?? null },
          }),
        ),
      ]);
    }

    // Fire-and-forget notifications for every buyer
    for (const o of orders) {
      if (!o.buyer) continue;
      void dispatchNotification('order_status', {
        phone: o.buyer.phone,
        profileId: o.buyer.id,
        message: statusUpdateMessage(o.orderNumber, status),
      });
      if (o.buyer.email) {
        void (async () => {
          try {
            const html = await render(OrderStatusEmail({
              orderNumber: o.orderNumber,
              storeName:   o.buyer!.storeName ?? o.buyerId,
              newStatus:   status,
            }));
            await sendEmail(o.buyer!.email!, `Order Update — ${o.orderNumber}`, html, 'status_update');
          } catch (e) {
            console.error('[EMAIL] Bulk status update email failed:', e);
          }
        })();
      }
    }

    // `skipped` is only ever non-empty for CANCELLED — tell the admin which
    // orders were left alone rather than silently reporting a smaller count.
    res.json({
      updated: orders.length,
      ids: orders.map((o) => o.id),
      ...(skipped.length > 0 ? { skipped } : {}),
    });
  },
);

// ─── POST /api/orders/:id/pay — BUYER initiates eSewa or Khalti ──────────────
router.post(
  '/:id/pay',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profile = (req as any).profile as { id: string; role: string };
    const id      = qs(req.params.id)!;
    const { method } = req.body as { method?: string };

    if (!method || !['ESEWA', 'KHALTI'].includes(method)) {
      res.status(400).json({ error: 'method must be ESEWA or KHALTI' });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (profile.role !== 'ADMIN' && order.buyerId !== profile.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (order.paymentStatus === 'PAID') {
      res.status(400).json({ error: 'Order is already paid' });
      return;
    }

    const transactionUuid = order.id; // orderId as stable idempotency key
    const merchantCode    = process.env.ESEWA_MERCHANT_CODE!;

    if (method === 'ESEWA') {
      const signMsg   = `total_amount=${order.total},transaction_uuid=${transactionUuid},product_code=${merchantCode}`;
      const signature = esewaSignature(signMsg);

      res.json({
        fields: {
          amount:                  order.subtotal,
          tax_amount:              order.vat,
          total_amount:            order.total,
          transaction_uuid:        transactionUuid,
          product_code:            merchantCode,
          product_service_charge:  0,
          product_delivery_charge: order.deliveryFee,
          success_url:             process.env.ESEWA_SUCCESS_URL,
          failure_url:             process.env.ESEWA_FAILURE_URL,
          signed_field_names:      'total_amount,transaction_uuid,product_code',
          signature,
        },
      });
      return;
    }

    // ── Khalti initiation ──
    const khaltiRes = await axios.post(
      'https://a.khalti.com/api/v2/epayment/initiate/',
      {
        return_url:          process.env.KHALTI_RETURN_URL,
        website_url:         process.env.KHALTI_WEBSITE_URL,
        amount:              Math.round(order.total * 100), // paisa
        purchase_order_id:   order.id,
        purchase_order_name: order.orderNumber,
      },
      {
        headers: {
          Authorization:  `Key ${process.env.KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    res.json({ paymentUrl: khaltiRes.data.payment_url });
  },
);

// ─── GET /api/orders/:id/invoice — IRD Nepal VAT PDF ─────────────────────────
router.get(
  '/:id/invoice',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profile = (req as any).profile as { id: string; role: string };
    const id      = qs(req.params.id)!;

    const order = await prisma.order.findUnique({
      where:   { id },
      include: {
        buyer: { select: { id: true, storeName: true, address: true, phone: true, email: true } },
        items: true,
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (profile.role !== 'ADMIN' && order.buyerId !== profile.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Use the VAT stored on the order (snapshot at order time), not a recompute.
    const vatAmount  = order.vat;
    const grandTotal = order.total;

    const companyName    = process.env.COMPANY_NAME    ?? 'DISTRO Nepal Pvt Ltd';
    const companyAddress = process.env.COMPANY_ADDRESS ?? 'Kathmandu, Nepal';
    const companyPan     = process.env.COMPANY_PAN     ?? '';

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${order.orderNumber}.pdf"`,
    );
    doc.pipe(res);

    // ── Header ──
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('TAX INVOICE', { align: 'center' })
      .fontSize(11)
      .text('(As per IRD Nepal)', { align: 'center' })
      .moveDown(0.5);

    // ── Company block ──
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(companyName, { align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(companyAddress, { align: 'center' })
      .text(`PAN: ${companyPan}`, { align: 'center' })
      .moveDown(1);

    // ── Invoice meta + Bill To ──
    const invoiceDate = order.createdAt.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const leftX  = 50;
    const rightX = 350;
    const y      = doc.y;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Bill To:', leftX, y);
    doc.text('Invoice No:', rightX, y);

    doc.font('Helvetica').fontSize(10);
    doc.text(order.buyer.storeName ?? 'N/A', leftX, y + 14);
    doc.text(order.buyer.address   ?? order.deliveryAddress ?? 'N/A', leftX, y + 26);
    doc.text(order.buyer.phone,    leftX, y + 38);

    doc.text(order.orderNumber,  rightX, y + 14);
    doc.font('Helvetica-Bold').text('Date:',         rightX, y + 26);
    doc.font('Helvetica').text(invoiceDate,          rightX + 35, y + 26);

    doc.moveDown(5);

    // ── Items table ──
    const tableTop = doc.y;
    const colX     = { item: 50, qty: 290, unit: 360, amount: 450 };
    const rowH     = 20;

    // Table header
    doc.font('Helvetica-Bold').fontSize(10);
    doc.rect(leftX, tableTop, 510, rowH).fillAndStroke('#1A4BDB', '#1A4BDB');
    doc.fillColor('white');
    doc.text('Item Name',   colX.item,   tableTop + 5);
    doc.text('Qty',         colX.qty,    tableTop + 5);
    doc.text('Unit Price',  colX.unit,   tableTop + 5);
    doc.text('Amount',      colX.amount, tableTop + 5);
    doc.fillColor('black');

    // Table rows
    let rowY = tableTop + rowH;
    doc.font('Helvetica').fontSize(10);

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const bg   = i % 2 === 0 ? '#F7F9FF' : 'white';
      doc.rect(leftX, rowY, 510, rowH).fill(bg).stroke('#cccccc');
      doc.fillColor('black');
      // Carton rows show pieces-per-carton in the description; qty carries its unit.
      const desc = item.unit === 'CARTON' && item.piecesPerCarton != null
        ? `${item.name} (${item.piecesPerCarton} pcs/ctn)`
        : item.name;
      doc.text(desc,                                       colX.item,   rowY + 5, { width: 230, ellipsis: true });
      doc.text(`${item.qty} ${unitLabel(item.unit)}`,      colX.qty,    rowY + 5);
      doc.text(`Rs ${item.price.toFixed(2)}`,              colX.unit,   rowY + 5);
      doc.text(`Rs ${item.total.toFixed(2)}`,              colX.amount, rowY + 5);
      rowY += rowH;
    }

    doc.moveDown(0.5);
    doc.y = rowY + 10;

    // ── Totals block ──
    const totalsX = 350;
    const valX    = 470;

    const totalsLine = (label: string, value: string, bold = false): void => {
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fontSize(10);
      doc.text(label, totalsX, doc.y, { continued: false });
      doc.text(value, valX,    doc.y - 12);
      doc.moveDown(0.3);
    };

    totalsLine('Subtotal (excl. VAT):', `Rs ${order.subtotal.toFixed(2)}`);
    totalsLine('VAT 13%:',              `Rs ${vatAmount.toFixed(2)}`);
    if (order.deliveryFee > 0) {
      totalsLine('Delivery Fee:',       `Rs ${order.deliveryFee.toFixed(2)}`);
    }
    doc
      .moveTo(totalsX, doc.y)
      .lineTo(560, doc.y)
      .stroke();
    doc.moveDown(0.3);
    totalsLine('Grand Total:',          `Rs ${grandTotal.toFixed(2)}`, true);

    // ── Footer ──
    doc
      .moveDown(3)
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#666666')
      .text('This is a computer generated invoice', { align: 'center' });

    doc.end();

    // Non-blocking invoice notification
    if (order.buyer.email) {
      void (async () => {
        try {
          const html = await render(InvoiceEmail({
            orderNumber: order.orderNumber,
            storeName:   order.buyer.storeName ?? order.buyer.phone,
            total:       grandTotal,
          }));
          await sendEmail(order.buyer.email!, `Invoice Ready — ${order.orderNumber}`, html, 'invoice');
        } catch (e) {
          console.error('[EMAIL] Invoice pipeline failed:', e);
        }
      })();
    }
  },
);

// ─── PATCH /api/orders/:id/cancel — BUYER cancels own order within 30 min ───
router.patch(
  '/:id/cancel',
  requireAuth,
  requireRole('BUYER'),
  async (req: Request, res: Response): Promise<void> => {
    const profile = (req as any).profile as { id: string; phone: string; email?: string | null };
    const id = qs(req.params.id)!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.buyerId !== profile.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (order.status !== 'PENDING') {
      res.status(400).json({ error: 'Only PENDING orders can be cancelled' });
      return;
    }
    if (order.paymentStatus === 'PAID') {
      res.status(400).json({ error: 'Paid orders must be cancelled by support' });
      return;
    }
    if (Date.now() - order.createdAt.getTime() > 30 * 60 * 1000) {
      res.status(400).json({ error: 'Cancellation window has passed (30 minutes)' });
      return;
    }

    let cancelled: any;
    try {
      cancelled = await withTransaction(async (tx) => {
        // Status change and reversal share one transaction — a partial
        // reversal is worse than none.
        await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } });

        // PAID orders never reach here (guarded above), so the credit always
        // needs reversing on this path.
        await reverseOrderEffects(tx, order, { reverseCredit: true });

        await tx.orderActivity.create({
          data: { orderId: id, status: 'CANCELLED', note: 'Cancelled by buyer' },
        });

        return tx.order.findUnique({ where: { id }, include: { items: true } });
      });
    } catch (err) {
      console.error('[ORDER] Cancel failed:', err);
      res.status(500).json({ error: (err as Error).message || 'Cancel failed' });
      return;
    }

    // Fire-and-forget notifications
    void dispatchNotification('order_cancelled', {
      phone: profile.phone,
      profileId: profile.id,
      message: `Order ${order.orderNumber} has been cancelled.`,
    });
    if (profile.email) {
      void (async () => {
        try {
          const html = await render(OrderStatusEmail({
            orderNumber: order.orderNumber,
            storeName: (profile as any).storeName ?? profile.phone,
            newStatus: 'CANCELLED',
          }));
          await sendEmail(profile.email!, `Order Cancelled — ${order.orderNumber}`, html, 'status_update');
        } catch (e) {
          console.error('[EMAIL] Cancel notification failed:', e);
        }
      })();
    }

    res.json({ order: cancelled });
  },
);

// ─── POST /api/orders/:id/reorder — BUYER pre-fills cart from past order ────
router.post(
  '/:id/reorder',
  requireAuth,
  requireRole('BUYER'),
  async (req: Request, res: Response): Promise<void> => {
    const profile = (req as any).profile as { id: string };
    const id = qs(req.params.id)!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.buyerId !== profile.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const productIds = order.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Buyer-facing: no raw stockQty — expose stockStatus + maxOrderQty instead.
    const reorderItems = order.items.map((row) => {
      const p = productMap.get(row.productId);
      if (!p) {
        return {
          productId: row.productId,
          name: row.name,
          sellUnit: row.unit,
          price: row.price,
          qty: row.qty,
          piecesPerCarton: row.piecesPerCarton,
          imageUrl: null,
          moq: 1,
          stockStatus: 'OUT_OF_STOCK' as const,
          maxOrderQty: 0,
          available: false,
        };
      }
      const cap = maxOrderQty(p);
      return {
        productId: row.productId,
        name: p.name,
        sellUnit: p.sellUnit,
        price: unitPrice(p),
        qty: row.qty,
        piecesPerCarton: p.sellUnit === 'CARTON' ? piecesPerSellUnit(p) : null,
        imageUrl: p.imageUrl ?? null,
        moq: moqUnits(p),
        stockStatus: stockStatus(p),
        maxOrderQty: cap,
        available: p.active && cap >= row.qty,
      };
    });

    res.json({ items: reorderItems });
  },
);

export default router;
