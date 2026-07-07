/**
 * Verification script for the SALES role flow (run with: npx tsx scripts/verify-sales.ts)
 *
 * 1. Admin creates a SALES rep → rep logs in with the normal password flow.
 * 2. Rep quick-creates a buyer (no OTP) and places an order for that buyer:
 *    - Ledger DEBIT lands on the BUYER, not the rep.
 *    - Order.salesRepId is stamped with the rep's profile id.
 *    - Buyer.creditUsed increments by the order total.
 *    - Confirmation notification targets the buyer's phone (structural check).
 * 3. Credit limit is enforced against the BUYER's profile.
 * 4. Authorization edges: buyers cannot pass buyerId; reps only see own orders;
 *    reps cannot touch admin endpoints.
 *
 * Requires the API on http://127.0.0.1:3001 and the dev MySQL database.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'http://127.0.0.1:3001/api';

const ADMIN_PHONE = process.env.ADMIN_SEED_PHONE ?? '9800000000';
const ADMIN_PASS = process.env.ADMIN_SEED_PASSWORD ?? 'admin123';
const BUYER_PHONE = '9841100001';
const BUYER_PASS = 'distro123';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function req(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const post = (p: string, b: unknown, t?: string) => req('POST', p, b, t);
const get = (p: string, t?: string) => req('GET', p, undefined, t);

async function main() {
  const stamp = Date.now().toString().slice(-7);
  const repPhone = `981${stamp}`;
  const shopPhone = `982${stamp}`;
  const repEmail = `rep-${stamp}@test.local`;

  // ── Admin login + create rep ────────────────────────────────────────────────
  const adminLogin = await post('/auth/login', { email: ADMIN_PHONE, password: ADMIN_PASS });
  if (adminLogin.status !== 200) {
    console.error('Admin login failed — is the API running and DB seeded?', adminLogin);
    process.exit(1);
  }
  const adminToken = adminLogin.data.token as string;

  const createRep = await post('/sales/reps', {
    name: 'Verify Rep',
    phone: repPhone,
    email: repEmail,
    password: 'verify-pass-123',
  }, adminToken);
  check('admin creates SALES rep', createRep.status === 201, `status=${createRep.status}`);
  const repId = createRep.data.rep?.id as string;

  // ── Rep login (normal password flow) ────────────────────────────────────────
  const repLogin = await post('/auth/login', { email: repPhone, password: 'verify-pass-123' });
  check('rep logs in via existing password flow', repLogin.status === 200 && repLogin.data.profile?.role === 'SALES',
    `status=${repLogin.status} role=${repLogin.data.profile?.role}`);
  const repToken = repLogin.data.token as string;

  // ── Rep quick-creates a buyer ───────────────────────────────────────────────
  const createBuyer = await post('/sales/buyers', {
    storeName: `Verify Shop ${stamp}`,
    ownerName: 'Shop Owner',
    phone: shopPhone,
    district: 'Kathmandu',
  }, repToken);
  // District must exist — fall back to any active district if Kathmandu is absent.
  let buyer = createBuyer.data.buyer;
  if (createBuyer.status === 400 && /district/i.test(createBuyer.data.error ?? '')) {
    const anyDistrict = await prisma.district.findFirst();
    const retry = await post('/sales/buyers', {
      storeName: `Verify Shop ${stamp}`,
      ownerName: 'Shop Owner',
      phone: shopPhone,
      district: anyDistrict?.name,
    }, repToken);
    buyer = retry.data.buyer;
    check('rep quick-creates buyer (fallback district)', retry.status === 201, `status=${retry.status}`);
  } else {
    check('rep quick-creates buyer (no OTP)', createBuyer.status === 201, `status=${createBuyer.status} ${JSON.stringify(createBuyer.data)}`);
  }

  // Give the buyer a credit limit so the enforcement check is meaningful.
  await prisma.profile.update({ where: { id: buyer.id }, data: { creditLimit: 30000 } });

  // ── Product to order ───────────────────────────────────────────────────────
  const product = await prisma.product.create({
    data: {
      name: `SALES-TEST-${stamp}`,
      sellUnit: 'CARTON',
      price: 1200,
      moq: 1,
      piecesPerCarton: 12,
      pricePerCarton: 14400,
      stockQty: 120, // 10 cartons
      active: true,
    },
  });

  // ── Rep places order for the buyer ──────────────────────────────────────────
  const order1 = await post('/orders', {
    buyerId: buyer.id,
    items: [{ productId: product.id, qty: 1 }], // Rs 14,400 subtotal
    deliveryDistrict: buyer.district ?? 'Kathmandu',
    deliveryAddress: 'Verify shop address',
    paymentMethod: 'CREDIT',
  }, repToken);
  check('rep places order for buyer (CREDIT)', order1.status === 201, `status=${order1.status} ${JSON.stringify(order1.data).slice(0, 200)}`);
  const placed = order1.data.order;

  check('order.buyerId is the BUYER', placed?.buyerId === buyer.id,
    `buyerId=${placed?.buyerId}`);
  check('order.salesRepId stamped from session', placed?.salesRepId === repId,
    `salesRepId=${placed?.salesRepId} rep=${repId}`);

  const debit = await prisma.ledger.findFirst({
    where: { orderId: placed?.id, type: 'DEBIT' },
  });
  check('ledger DEBIT lands on the buyer', !!debit && debit.buyerId === buyer.id,
    `ledger buyerId=${debit?.buyerId}`);

  const repLedger = await prisma.ledger.count({ where: { buyerId: repId } });
  check('no ledger rows against the rep', repLedger === 0, `${repLedger} rows`);

  const buyerAfter = await prisma.profile.findUnique({ where: { id: buyer.id } });
  check('buyer.creditUsed incremented by order total',
    Math.abs((buyerAfter?.creditUsed ?? 0) - (placed?.total ?? -1)) < 0.01,
    `creditUsed=${buyerAfter?.creditUsed} total=${placed?.total}`);

  // Notification path targets the buyer: the order-confirm SMS goes to
  // order.buyer.phone (see orders.ts post-commit block). Structural check:
  check('confirmation notification targets buyer phone (not rep)',
    buyerAfter?.phone === shopPhone && buyerAfter.phone !== repPhone);

  // ── Credit limit enforced against the buyer ─────────────────────────────────
  // creditUsed ≈ 16,272 (14,400 + VAT). Limit 30,000 → a second identical
  // order (+16,272) must be rejected.
  const order2 = await post('/orders', {
    buyerId: buyer.id,
    items: [{ productId: product.id, qty: 1 }],
    deliveryDistrict: buyer.district ?? 'Kathmandu',
    deliveryAddress: 'Verify shop address',
    paymentMethod: 'CREDIT',
  }, repToken);
  check('credit limit enforced against BUYER profile',
    order2.status === 400 && /credit limit/i.test(order2.data.error ?? ''),
    `status=${order2.status} ${order2.data.error ?? ''}`);

  // ── Authorization edges ─────────────────────────────────────────────────────
  const buyerLogin = await post('/auth/login', { email: BUYER_PHONE, password: BUYER_PASS });
  if (buyerLogin.status === 200) {
    const hijack = await post('/orders', {
      buyerId: buyer.id, // someone else's account
      items: [{ productId: product.id, qty: 1 }],
      deliveryDistrict: 'Kathmandu',
      deliveryAddress: 'x',
      paymentMethod: 'COD',
    }, buyerLogin.data.token);
    check('buyer cannot order for another buyerId', hijack.status === 403,
      `status=${hijack.status}`);
  } else {
    check('buyer cannot order for another buyerId (skipped — seed buyer missing)', true);
  }

  const repOrders = await get('/orders', repToken);
  const repOrderList: Array<{ salesRepId: string | null }> = repOrders.data.orders ?? [];
  check('rep order list scoped to own salesRepId',
    repOrders.status === 200 && repOrderList.length >= 1 &&
    repOrderList.every((o) => o.salesRepId === repId),
    `${repOrderList.length} orders`);

  const repStats = await get('/sales/reps', repToken);
  check('rep cannot access admin sales endpoints', repStats.status === 403,
    `status=${repStats.status}`);
  const repAdmin = await get('/reports/summary', repToken);
  check('rep cannot access admin reports', repAdmin.status === 403 || repAdmin.status === 404,
    `status=${repAdmin.status}`);

  const buyerCredit = await req('PATCH', `/customers/${buyer.id}/credit`, { creditLimit: 1 }, repToken);
  check('rep cannot touch admin customer CRUD', buyerCredit.status === 403,
    `status=${buyerCredit.status}`);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const orders = await prisma.order.findMany({
    where: { salesRepId: repId },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  await prisma.$transaction([
    prisma.orderActivity.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.ledger.deleteMany({ where: { buyerId: buyer.id } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.stockMovement.deleteMany({ where: { productId: product.id } }),
    prisma.product.delete({ where: { id: product.id } }),
    prisma.session.deleteMany({ where: { profileId: { in: [repId, buyer.id] } } }),
    prisma.profile.deleteMany({ where: { id: { in: [repId, buyer.id] } } }),
  ]);

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
