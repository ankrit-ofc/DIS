import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma';

/**
 * Guards the duplicate-order bug: POST /orders had no client-supplied request
 * id, so the server could not tell a retry from a new order. Field reps work on
 * patchy mobile data in shops, so "order commits, response is lost, rep taps
 * again" is routine — and the cost was a second real order against the shop's
 * credit line.
 *
 * These tests exercise the DATABASE guarantee rather than the HTTP handler,
 * deliberately and for the same reason as orderReversal.test.ts: the guard that
 * actually holds under two simultaneous retries is the unique index, not the
 * pre-flight SELECT in the route. A mocked client would happily "pass" a test
 * for a constraint that was never created. The route's replay branch is thin
 * glue over exactly these two behaviours (findUnique hit → 200 replay, P2002 →
 * re-read the winner).
 *
 * Runs against the local MySQL from DATABASE_URL. All fixture rows are prefixed
 * `idemtest_` and dropped between tests, so this never touches real data; it
 * refuses to run against a non-local database.
 */

const P = 'idemtest_';
const START_STOCK = 1000;

function guardDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Refusing to run destructive tests against non-local DATABASE_URL: ${url}`);
  }
}

async function wipe(): Promise<void> {
  await prisma.orderItem.deleteMany({ where: { orderId: { startsWith: P } } });
  await prisma.order.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.order.deleteMany({ where: { idempotencyKey: { startsWith: P } } });
  await prisma.product.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profile.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.category.deleteMany({ where: { id: { startsWith: P } } });
}

async function seed(): Promise<void> {
  await prisma.profile.create({
    data: {
      id: `${P}buyer`,
      phone: '9800000888',
      passwordHash: '',
      role: 'BUYER',
      status: 'ACTIVE',
      storeName: 'Idempotency Test Shop',
      creditLimit: 500_000,
      creditUsed: 0,
    },
  });
  await prisma.profile.create({
    data: {
      id: `${P}other`,
      phone: '9800000887',
      passwordHash: '',
      role: 'BUYER',
      status: 'ACTIVE',
      storeName: 'Other Idempotency Shop',
    },
  });
  await prisma.category.create({ data: { id: `${P}cat`, name: 'Idempotency Test Cat' } });
  await prisma.product.create({
    data: {
      id: `${P}product`,
      categoryId: `${P}cat`,
      name: 'Idempotency Test Product',
      unit: 'can',
      price: 106.25,
      stockQty: START_STOCK,
      sellUnit: 'CARTON',
      piecesPerCarton: 24,
      pricePerCarton: 2550,
    },
  });
}

/** One order carrying `key`, mimicking what the route's transaction writes. */
function createOrder(key: string | null, opts: { buyerId?: string; suffix?: string } = {}) {
  const suffix = opts.suffix ?? Math.random().toString(36).slice(2, 8);
  return prisma.order.create({
    data: {
      id: `${P}order_${suffix}`,
      orderNumber: `ORD-IDEMTEST-${suffix}`,
      buyerId: opts.buyerId ?? `${P}buyer`,
      paymentMethod: 'COD',
      subtotal: 10_200,
      vat: 1_326,
      deliveryFee: 0,
      total: 11_526,
      idempotencyKey: key,
    },
  });
}

beforeEach(async () => {
  guardDatabase();
  await wipe();
  await seed();
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('POST /orders idempotency key', () => {
  it('rejects a second order reusing the same key', async () => {
    const key = `${P}key_reuse`;
    await createOrder(key, { suffix: 'first' });

    // This is what a retry that raced past the pre-flight read hits.
    await expect(createOrder(key, { suffix: 'second' })).rejects.toMatchObject({
      code: 'P2002',
    });

    const orders = await prisma.order.findMany({ where: { idempotencyKey: key } });
    expect(orders).toHaveLength(1);
  });

  it('surfaces idempotencyKey as the conflicting target so the route can tell it apart', async () => {
    // The route only replays on P2002 when the violated constraint is this one
    // — a P2002 on orderNumber is a genuine 500, not a replay.
    const key = `${P}key_target`;
    await createOrder(key, { suffix: 'a' });

    const err = await createOrder(key, { suffix: 'b' }).catch((e) => e);
    expect(String(err.meta?.target ?? '')).toContain('idempotencyKey');
  });

  it('lets the winner be re-read by key, which is what the retry receives', async () => {
    const key = `${P}key_winner`;
    const winner = await createOrder(key, { suffix: 'winner' });

    const replayed = await prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true },
    });
    expect(replayed?.id).toBe(winner.id);
    expect(replayed?.orderNumber).toBe(winner.orderNumber);
  });

  it('creates exactly one order when retries race', async () => {
    // The realistic failure: the rep taps twice on a stalled connection and
    // both requests are in flight. The pre-flight SELECT cannot help here —
    // both miss — so this is precisely what the unique index is for.
    const key = `${P}key_race`;
    const results = await Promise.allSettled([
      createOrder(key, { suffix: 'r1' }),
      createOrder(key, { suffix: 'r2' }),
      createOrder(key, { suffix: 'r3' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);

    const orders = await prisma.order.findMany({ where: { idempotencyKey: key } });
    expect(orders).toHaveLength(1);
  });

  it('allows many orders with no key, so existing clients are unaffected', async () => {
    // MySQL permits unlimited NULLs under a UNIQUE index. This is what makes
    // the column safe to add to a live table: every historical order is NULL,
    // and a client that never sends the header keeps working.
    await createOrder(null, { suffix: 'n1' });
    await createOrder(null, { suffix: 'n2' });
    await createOrder(null, { suffix: 'n3' });

    const orders = await prisma.order.findMany({
      where: { id: { startsWith: `${P}order_n` } },
    });
    expect(orders).toHaveLength(3);
    expect(orders.every((o) => o.idempotencyKey === null)).toBe(true);
  });

  it('scopes a replay to the owning buyer', async () => {
    // A key is a bearer token for whatever order it created. The route checks
    // buyerId before replaying so one account cannot read another's order by
    // guessing or replaying a key; this asserts the data it checks against.
    const key = `${P}key_owner`;
    await createOrder(key, { buyerId: `${P}buyer`, suffix: 'owned' });

    const found = await prisma.order.findUnique({ where: { idempotencyKey: key } });
    expect(found?.buyerId).toBe(`${P}buyer`);
    expect(found?.buyerId).not.toBe(`${P}other`);
  });
});
