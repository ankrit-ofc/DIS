/**
 * Verification script for the concurrency fixes (run with: npx tsx scripts/verify-concurrency.ts)
 *
 * 1. Stock race (CARTON product): fires 5 concurrent 1-carton orders at a
 *    product with stock for exactly 2 cartons — expects exactly 2 to succeed,
 *    the rest rejected with the structured 409 INSUFFICIENT_STOCK shape, and
 *    stock to end at 0 (never negative).
 * 2. Stock race (PIECE product): same, with piece-based quantities.
 * 3. Ledger integrity: checks every ledger entry's running balance equals the
 *    previous balance ± amount.
 * 4. OTP concurrency: two different users request + verify OTPs concurrently —
 *    both must succeed (no "no match", no cross-user rate-limit lockout).
 *
 * Requires the API on http://127.0.0.1:3001 and the dev MySQL database.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://127.0.0.1:3001/api';

const BUYER_PHONE = '9841100001';
const BUYER_PASS = 'distro123';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  // ── Login as seeded buyer ──────────────────────────────────────────────────
  const login = await post('/auth/login', { email: BUYER_PHONE, password: BUYER_PASS });
  if (login.status !== 200) {
    console.error('Buyer login failed — is the API running and DB seeded?', login);
    process.exit(1);
  }
  const token = login.data.token as string;
  const buyerId = login.data.profile.id as string;

  // ── 1. Stock race — CARTON product ────────────────────────────────────────
  // Stock for exactly 2 cartons; carton price clears the Rs 10,000 minimum.
  const product = await prisma.product.create({
    data: {
      name: `RACE-TEST-CTN-${Date.now()}`,
      sellUnit: 'CARTON',
      price: 1500,
      moq: 1, // 1 carton minimum
      piecesPerCarton: 10,
      pricePerCarton: 15000,
      stockQty: 20, // 2 cartons
      active: true,
    },
  });

  const attempts = await Promise.all(
    Array.from({ length: 5 }, () =>
      post(
        '/orders',
        {
          items: [{ productId: product.id, qty: 1 }],
          deliveryDistrict: 'Kathmandu',
          deliveryAddress: 'Concurrency test address',
          paymentMethod: 'COD',
        },
        token,
      ),
    ),
  );

  const succeeded = attempts.filter((a) => a.status === 201);
  const rejected = attempts.filter((a) => a.status === 409);
  const after = await prisma.product.findUnique({ where: { id: product.id } });

  check('CARTON: exactly 2 of 5 concurrent orders succeed', succeeded.length === 2,
    `${succeeded.length} succeeded, ${rejected.length} rejected`);
  check('CARTON: stock never goes negative', (after?.stockQty ?? -1) === 0,
    `stockQty = ${after?.stockQty}`);
  check('CARTON: rejects carry structured 409 INSUFFICIENT_STOCK',
    rejected.length === 3 && rejected.every((a) =>
      a.data.code === 'INSUFFICIENT_STOCK' &&
      Array.isArray(a.data.items) &&
      a.data.items[0]?.productId === product.id &&
      typeof a.data.items[0]?.available === 'number'),
    JSON.stringify(rejected[0]?.data ?? {}));
  check('CARTON: OrderItem snapshots unit', succeeded.length > 0 &&
    succeeded.every((a) => a.data.order?.items?.[0]?.unit === 'CARTON'),
    `unit=${succeeded[0]?.data.order?.items?.[0]?.unit}`);

  const movements = await prisma.stockMovement.count({
    where: { productId: product.id, type: 'OUT' },
  });
  check('CARTON: StockMovement OUT rows created (in pieces)', movements === succeeded.length,
    `${movements} rows`);
  const movementPieces = await prisma.stockMovement.aggregate({
    where: { productId: product.id, type: 'OUT' },
    _sum: { qty: true },
  });
  check('CARTON: StockMovement qty is pieces (2 cartons = 20 pcs)',
    (movementPieces._sum.qty ?? 0) === 20, `sum=${movementPieces._sum.qty}`);

  // ── 2. Stock race — PIECE product ─────────────────────────────────────────
  // 100 pcs in stock, MOQ 40 pcs, Rs 300/pc → each 40-pc order is Rs 12,000
  // (clears the minimum) and only 2 of 5 concurrent orders can be filled.
  const pieceProduct = await prisma.product.create({
    data: {
      name: `RACE-TEST-PCS-${Date.now()}`,
      sellUnit: 'PIECE',
      price: 300,
      moq: 40,
      stockQty: 100,
      active: true,
    },
  });

  const pieceAttempts = await Promise.all(
    Array.from({ length: 5 }, () =>
      post(
        '/orders',
        {
          items: [{ productId: pieceProduct.id, qty: 40 }],
          deliveryDistrict: 'Kathmandu',
          deliveryAddress: 'Concurrency test address',
          paymentMethod: 'COD',
        },
        token,
      ),
    ),
  );

  const pieceOk = pieceAttempts.filter((a) => a.status === 201);
  const pieceRejected = pieceAttempts.filter((a) => a.status === 409);
  const pieceAfter = await prisma.product.findUnique({ where: { id: pieceProduct.id } });

  check('PIECE: exactly 2 of 5 concurrent orders succeed', pieceOk.length === 2,
    `${pieceOk.length} succeeded, ${pieceRejected.length} rejected`);
  check('PIECE: stock ends at 20 pcs, never negative', (pieceAfter?.stockQty ?? -1) === 20,
    `stockQty = ${pieceAfter?.stockQty}`);
  check('PIECE: rejects report available in pieces',
    pieceRejected.every((a) =>
      a.data.code === 'INSUFFICIENT_STOCK' && a.data.items?.[0]?.available <= 20),
    JSON.stringify(pieceRejected[0]?.data ?? {}));
  check('PIECE: OrderItem snapshots unit', pieceOk.length > 0 &&
    pieceOk.every((a) => a.data.order?.items?.[0]?.unit === 'PIECE'),
    `unit=${pieceOk[0]?.data.order?.items?.[0]?.unit}`);
  check('PIECE: MOQ enforced (39 pcs rejected)',
    (await post('/orders', {
      items: [{ productId: pieceProduct.id, qty: 39 }],
      deliveryDistrict: 'Kathmandu',
      deliveryAddress: 'Concurrency test address',
      paymentMethod: 'COD',
    }, token)).status === 400);

  // ── 2. Ledger integrity ───────────────────────────────────────────────────
  const entries = await prisma.ledger.findMany({
    where: { buyerId },
    orderBy: { createdAt: 'asc' },
  });
  let ledgerOk = true;
  let prev = 0;
  for (const e of entries) {
    const expected = e.type === 'DEBIT' ? prev + e.amount : prev - e.amount;
    if (Math.abs(expected - e.balance) > 0.01) {
      ledgerOk = false;
      console.log(`  ledger break at ${e.id}: prev ${prev}, ${e.type} ${e.amount}, stored ${e.balance}`);
    }
    prev = e.balance;
  }
  check('ledger running balance consistent', ledgerOk, `${entries.length} entries`);

  // ── 3. OTP concurrency (two users at once) ────────────────────────────────
  const phoneA = '9812345671';
  const phoneB = '9812345672';

  const [reqA, reqB] = await Promise.all([
    post('/auth/request-otp', { phone: phoneA }),
    post('/auth/request-otp', { phone: phoneB }),
  ]);
  check('concurrent OTP requests both accepted', reqA.status === 200 && reqB.status === 200,
    `A=${reqA.status} B=${reqB.status}`);

  // Read the live codes straight from the DB (SMS is disabled in dev)
  async function liveCode(phone: string): Promise<string | undefined> {
    const p = await prisma.profile.findUnique({ where: { phone } });
    if (!p) return undefined;
    const c = await prisma.otpCode.findFirst({
      where: { profileId: p.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return c?.code;
  }
  const [codeA, codeB] = await Promise.all([liveCode(phoneA), liveCode(phoneB)]);
  check('OTP codes stored in OtpCode table', !!codeA && !!codeB);

  const [verA, verB] = await Promise.all([
    post('/auth/verify-otp', { phone: phoneA, otp: codeA }),
    post('/auth/verify-otp', { phone: phoneB, otp: codeB }),
  ]);
  check('concurrent verifies both succeed (no "no match"/lockout)',
    verA.status === 200 && verB.status === 200,
    `A=${verA.status}(${JSON.stringify(verA.data)}) B=${verB.status}(${JSON.stringify(verB.data)})`);

  // Double-request: an older (but recent) code must STILL verify
  const phoneC = '9812345673';
  await post('/auth/request-otp', { phone: phoneC });
  const firstCode = await liveCode(phoneC);
  await post('/auth/request-otp', { phone: phoneC });
  const verFirst = await post('/auth/verify-otp', { phone: phoneC, otp: firstCode });
  check('older of 2 live codes still verifies after re-request', verFirst.status === 200,
    `status=${verFirst.status}`);

  // Brute-force guard: 5 wrong guesses invalidate the code
  const phoneD = '9812345674';
  await post('/auth/request-otp', { phone: phoneD });
  const codeD = await liveCode(phoneD);
  for (let i = 0; i < 5; i++) {
    await post('/auth/verify-otp', { phone: phoneD, otp: '000000' });
  }
  const verBurned = await post('/auth/verify-otp', { phone: phoneD, otp: codeD });
  check('code invalidated after 5 wrong attempts', verBurned.status === 400,
    `status=${verBurned.status}`);

  // ── Cleanup test data ─────────────────────────────────────────────────────
  const testProductIds = [product.id, pieceProduct.id];
  const testOrders = await prisma.order.findMany({
    where: { items: { some: { productId: { in: testProductIds } } } },
    select: { id: true },
  });
  const orderIds = testOrders.map((o) => o.id);
  await prisma.$transaction([
    prisma.orderActivity.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.ledger.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.stockMovement.deleteMany({ where: { productId: { in: testProductIds } } }),
    prisma.product.deleteMany({ where: { id: { in: testProductIds } } }),
    prisma.profile.deleteMany({ where: { phone: { in: [phoneA, phoneB, phoneC, phoneD] } } }),
  ]);
  // Reverse the creditUsed the surviving debits added, so reruns stay clean
  const succeededTotal =
    succeeded.reduce((s, a) => s + (a.data.order?.total ?? 0), 0) +
    pieceOk.reduce((s, a) => s + (a.data.order?.total ?? 0), 0);
  if (succeededTotal > 0) {
    await prisma.profile.update({
      where: { id: buyerId },
      data: { creditUsed: { decrement: succeededTotal } },
    });
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
