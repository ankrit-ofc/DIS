import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { withTransaction } from '../transaction';
import { reverseOrderEffects, isOrderReversed, canAdminCancel } from '../orderReversal';

/**
 * Guards the data-integrity bug where admin cancellation flipped an order's
 * status without returning stock, reversing the ledger, or freeing the shop's
 * credit — silently leaking inventory and credit for orders that no longer
 * existed.
 *
 * Runs against the local MySQL from DATABASE_URL. All fixture rows are
 * prefixed `revtest_` and dropped between tests, so this never touches real
 * data; it refuses to run against a non-local database.
 */

const P = 'revtest_';
const START_STOCK = 1000;
const START_CREDIT_USED = 50_000;
const ORDER_TOTAL = 11_300;

function guardDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Refusing to run destructive tests against non-local DATABASE_URL: ${url}`);
  }
}

async function wipe(): Promise<void> {
  await prisma.stockMovement.deleteMany({ where: { productId: { startsWith: P } } });
  await prisma.ledger.deleteMany({ where: { buyerId: { startsWith: P } } });
  await prisma.orderActivity.deleteMany({ where: { orderId: { startsWith: P } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { startsWith: P } } });
  await prisma.order.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.product.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.profile.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.category.deleteMany({ where: { id: { startsWith: P } } });
}

/** One buyer, one CARTON product (24/carton), one order for 4 cartons. */
async function seed(opts: { paymentStatus?: 'UNPAID' | 'PAID' } = {}) {
  const buyerId = `${P}buyer`;
  const productId = `${P}product`;
  const orderId = `${P}order`;
  const orderNumber = 'ORD-REVTEST-1';

  await prisma.profile.create({
    data: {
      id: buyerId,
      phone: '9800000999',
      passwordHash: '',
      role: 'BUYER',
      status: 'ACTIVE',
      storeName: 'Reversal Test Shop',
      creditLimit: 500_000,
      creditUsed: START_CREDIT_USED,
    },
  });
  await prisma.category.create({ data: { id: `${P}cat`, name: 'Reversal Test Cat' } });
  await prisma.product.create({
    data: {
      id: productId,
      categoryId: `${P}cat`,
      name: 'Reversal Test Product',
      unit: 'can',
      price: 106.25,
      stockQty: START_STOCK,
      sellUnit: 'CARTON',
      piecesPerCarton: 24,
      pricePerCarton: 2550,
    },
  });
  await prisma.order.create({
    data: {
      id: orderId,
      orderNumber,
      buyerId,
      status: 'CONFIRMED',
      paymentStatus: opts.paymentStatus ?? 'UNPAID',
      paymentMethod: 'COD',
      subtotal: 10_200,
      vat: 1_100,
      deliveryFee: 0,
      total: ORDER_TOTAL,
    },
  });
  await prisma.orderItem.create({
    data: {
      id: `${P}item`,
      orderId,
      productId,
      name: 'Reversal Test Product',
      unit: 'CARTON',
      price: 2550,
      qty: 4,
      piecesPerCarton: 24,
      total: 10_200,
    },
  });
  // The DEBIT the order wrote when it was placed.
  await prisma.ledger.create({
    data: {
      id: `${P}debit`,
      buyerId,
      type: 'DEBIT',
      amount: ORDER_TOTAL,
      balance: ORDER_TOTAL,
      note: `Order ${orderNumber}`,
      orderId,
    },
  });

  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
}

const stockOf = async () =>
  (await prisma.product.findUniqueOrThrow({ where: { id: `${P}product` } })).stockQty;
const creditUsedOf = async () =>
  (await prisma.profile.findUniqueOrThrow({ where: { id: `${P}buyer` } })).creditUsed;
const reversalLedgerRows = () =>
  prisma.ledger.findMany({ where: { orderId: `${P}order`, type: 'CREDIT' } });

beforeEach(async () => {
  guardDatabase();
  await wipe();
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('reverseOrderEffects', () => {
  it('reverses all three effects: stock, ledger, and creditUsed', async () => {
    const order = await seed();

    const result = await withTransaction((tx) =>
      reverseOrderEffects(tx, order, { reverseCredit: true }),
    );

    expect(result.reversed).toBe(true);
    expect(result.creditReversed).toBe(true);
    expect(result.refundOwed).toBeNull();

    // 4 cartons x 24 pieces returned.
    expect(await stockOf()).toBe(START_STOCK + 96);
    expect(await creditUsedOf()).toBe(START_CREDIT_USED - ORDER_TOTAL);

    const credits = await reversalLedgerRows();
    expect(credits).toHaveLength(1);
    expect(credits[0].amount).toBe(ORDER_TOTAL);
    expect(credits[0].note).toBe('Cancel ORD-REVTEST-1');

    const movements = await prisma.stockMovement.findMany({
      where: { productId: `${P}product`, type: 'IN' },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].qty).toBe(96);
  });

  it('is a no-op on a second call — stock is not double-restored', async () => {
    const order = await seed();

    await withTransaction((tx) => reverseOrderEffects(tx, order, { reverseCredit: true }));
    const stockAfterFirst = await stockOf();
    const creditAfterFirst = await creditUsedOf();

    const second = await withTransaction((tx) =>
      reverseOrderEffects(tx, order, { reverseCredit: true }),
    );

    expect(second.reversed).toBe(false);
    expect(second.stockRestored).toEqual([]);
    expect(await stockOf()).toBe(stockAfterFirst);
    expect(await creditUsedOf()).toBe(creditAfterFirst);
    expect(await reversalLedgerRows()).toHaveLength(1);
  });

  it('restores stock but not credit for an already-paid order, and reports the refund', async () => {
    const order = await seed({ paymentStatus: 'PAID' });
    // The payment webhook already released the credit for a settled order.
    const creditBefore = await creditUsedOf();

    const result = await withTransaction((tx) =>
      reverseOrderEffects(tx, order, { reverseCredit: false }),
    );

    expect(result.reversed).toBe(true);
    expect(result.creditReversed).toBe(false);
    expect(result.refundOwed).toBe(ORDER_TOTAL);

    expect(await stockOf()).toBe(START_STOCK + 96);
    // Reversing again here would have driven creditUsed negative.
    expect(await creditUsedOf()).toBe(creditBefore);
    expect(await reversalLedgerRows()).toHaveLength(0);
  });

  it('rolls back completely when the surrounding transaction fails', async () => {
    const order = await seed();

    await expect(
      withTransaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
        await reverseOrderEffects(tx, order, { reverseCredit: true });
        // Something downstream blows up after a full reversal.
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // A partial reversal is worse than none — nothing may survive.
    expect(await stockOf()).toBe(START_STOCK);
    expect(await creditUsedOf()).toBe(START_CREDIT_USED);
    expect(await reversalLedgerRows()).toHaveLength(0);
    expect(await prisma.stockMovement.count({ where: { productId: `${P}product` } })).toBe(0);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('CONFIRMED');
  });

  it('uses the at-order carton snapshot, not the product current value', async () => {
    const order = await seed();
    // Carton size changes after the order was placed.
    await prisma.product.update({
      where: { id: `${P}product` },
      data: { piecesPerCarton: 12 },
    });

    await withTransaction((tx) => reverseOrderEffects(tx, order, { reverseCredit: true }));

    // 4 x 24 from the snapshot, not 4 x 12 from the product's new size.
    expect(await stockOf()).toBe(START_STOCK + 96);
  });

  it('isOrderReversed ignores payment credits, which share the orderId', async () => {
    const order = await seed({ paymentStatus: 'PAID' });
    await prisma.ledger.create({
      data: {
        id: `${P}paycredit`,
        buyerId: order.buyerId,
        type: 'CREDIT',
        amount: ORDER_TOTAL,
        balance: 0,
        note: `eSewa payment for ${order.orderNumber}`,
        orderId: order.id,
      },
    });

    const seen = await withTransaction((tx) =>
      isOrderReversed(tx, order.id, order.orderNumber),
    );
    expect(seen).toBe(false);
  });
});

describe('canAdminCancel', () => {
  it('allows the pre-delivery statuses', () => {
    for (const s of ['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED']) {
      expect(canAdminCancel(s)).toBe(true);
    }
  });

  it('refuses DELIVERED — that is a return, not a cancellation', () => {
    expect(canAdminCancel('DELIVERED')).toBe(false);
  });

  it('refuses an order that is already CANCELLED', () => {
    expect(canAdminCancel('CANCELLED')).toBe(false);
  });
});
