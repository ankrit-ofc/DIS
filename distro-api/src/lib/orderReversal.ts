import { Prisma } from '@prisma/client';

/**
 * Undo the financial and inventory effects of an order.
 *
 * Placing an order has three side effects (see POST /orders): stock is
 * decremented, a Ledger DEBIT is written, and Profile.creditUsed goes up.
 * Cancelling has to undo all three or none — a partial reversal leaves the
 * books in a state nobody can reconcile, which is why this always runs inside
 * the caller's transaction alongside the status change.
 *
 * Previously the buyer cancel route inlined this logic and the two admin
 * status routes simply flipped `status`, so every admin cancellation leaked
 * inventory and consumed the shop's credit line for an order that no longer
 * existed. One routine, used by every path, is what stops that recurring.
 */

/** The order shape the reversal needs. Deliberately not tied to any caller. */
export interface ReversibleOrder {
  id: string;
  orderNumber: string;
  buyerId: string;
  total: number;
  paymentStatus: string;
  items: Array<{
    productId: string;
    unit: string;
    qty: number;
    piecesPerCarton: number | null;
  }>;
}

export interface ReversalResult {
  /** False when the order had already been reversed — nothing was written. */
  reversed: boolean;
  /** Pieces returned to stock, per product. Empty on a no-op. */
  stockRestored: Array<{ productId: string; pieces: number }>;
  /** True when a reversing Ledger CREDIT + creditUsed decrement were written. */
  creditReversed: boolean;
  /**
   * Set when the order was already settled: the money is with us but the goods
   * are not going out, so somebody owes the shop a refund. The caller records
   * this on the order's activity trail — an unreconciled payment is a
   * customer-facing failure, not just an accounting one.
   */
  refundOwed: number | null;
}

/** Note prefix that marks a Ledger row as a cancellation reversal. */
const REVERSAL_NOTE_PREFIX = 'Cancel ';

/**
 * Pieces represented by one order line.
 *
 * The at-order `piecesPerCarton` snapshot wins: the product's carton size may
 * have changed since, and stock must be returned in the units it left in.
 * Orders placed before the carton-fields migration have no snapshot, so those
 * fall back to the product's current value — a guess, but a far better one
 * than 1. Callers pass that fallback in rather than this helper querying, so
 * the whole reversal stays a single pass over the items.
 */
function piecesOf(
  item: ReversibleOrder['items'][number],
  currentPiecesPerCarton: number | null,
): number {
  if (item.unit !== 'CARTON') return item.qty;
  return item.qty * (item.piecesPerCarton ?? currentPiecesPerCarton ?? 1);
}

/**
 * Has this order already been reversed?
 *
 * Keyed on the reversing Ledger row rather than on `status === 'CANCELLED'`,
 * for two reasons. Orders cancelled by the old admin path are CANCELLED but
 * never reversed, so a status check would wrongly treat them as done. And
 * keying on the ledger lets a future reconciliation script reuse this same
 * routine to repair exactly those rows.
 *
 * Note the payment webhooks also write a CREDIT against the order (note
 * "eSewa payment for …"), so the note prefix — not just the type — is what
 * distinguishes a cancellation reversal.
 */
export async function isOrderReversed(
  tx: Prisma.TransactionClient,
  orderId: string,
  orderNumber: string,
): Promise<boolean> {
  const existing = await tx.ledger.findFirst({
    where: {
      orderId,
      type: 'CREDIT',
      note: `${REVERSAL_NOTE_PREFIX}${orderNumber}`,
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Reverse an order's stock and (conditionally) its credit.
 *
 * Idempotent: calling it twice on the same order performs no second restore.
 * MUST be called inside a transaction that also writes the CANCELLED status,
 * so the two can never diverge.
 *
 * `reverseCredit` is passed explicitly rather than inferred here, so the
 * decision is visible at each call site. It must be false for a settled order:
 * the payment webhook already wrote its own reversing CREDIT and decremented
 * creditUsed, so reversing again would double-count and drive creditUsed
 * negative.
 */
export async function reverseOrderEffects(
  tx: Prisma.TransactionClient,
  order: ReversibleOrder,
  opts: { reverseCredit: boolean },
): Promise<ReversalResult> {
  const noop: ReversalResult = {
    reversed: false,
    stockRestored: [],
    creditReversed: false,
    refundOwed: null,
  };

  // Serialise against concurrent orders/cancels/payment webhooks for this
  // buyer. Taken before the idempotency check so two racing cancels can't both
  // read "not yet reversed" and then both restore.
  await tx.$queryRaw`SELECT id FROM Profile WHERE id = ${order.buyerId} FOR UPDATE`;

  if (await isOrderReversed(tx, order.id, order.orderNumber)) return noop;

  // 1. Return stock, and record why it moved.
  const stockRestored: Array<{ productId: string; pieces: number }> = [];
  for (const item of order.items) {
    // Only needed for legacy CARTON rows with no snapshot — see piecesOf.
    const needsFallback = item.unit === 'CARTON' && item.piecesPerCarton == null;
    const current = needsFallback
      ? await tx.product.findUnique({
          where: { id: item.productId },
          select: { piecesPerCarton: true },
        })
      : null;

    const pieces = piecesOf(item, current?.piecesPerCarton ?? null);
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQty: { increment: pieces } },
    });
    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        type: 'IN',
        qty: pieces,
        reason: `${REVERSAL_NOTE_PREFIX}${order.orderNumber}`,
      },
    });
    stockRestored.push({ productId: item.productId, pieces });
  }

  // 2. Reverse the credit, unless the payment already did.
  if (opts.reverseCredit) {
    // Locking read: under REPEATABLE READ a plain SELECT would return this
    // transaction's stale snapshot rather than the latest committed balance.
    const lastRows = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT balance FROM Ledger WHERE buyerId = ${order.buyerId}
      ORDER BY createdAt DESC, id DESC LIMIT 1 FOR UPDATE`;
    const newBalance = Number(lastRows[0]?.balance ?? 0) - order.total;

    await tx.ledger.create({
      data: {
        buyerId: order.buyerId,
        type: 'CREDIT',
        amount: order.total,
        balance: newBalance,
        note: `${REVERSAL_NOTE_PREFIX}${order.orderNumber}`,
        orderId: order.id,
      },
    });
    await tx.profile.update({
      where: { id: order.buyerId },
      data: { creditUsed: { decrement: order.total } },
    });
  }

  return {
    reversed: true,
    stockRestored,
    creditReversed: opts.reverseCredit,
    refundOwed: opts.reverseCredit ? null : order.total,
  };
}

/**
 * Statuses an admin may cancel from. DELIVERED is excluded on purpose: once
 * goods have left, "cancel" is a return, and restoring stock for something
 * physically at the shop would invent inventory. Returns need their own flow.
 */
export const ADMIN_CANCELLABLE_FROM = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'DISPATCHED',
] as const;

export function canAdminCancel(status: string): boolean {
  return (ADMIN_CANCELLABLE_FROM as readonly string[]).includes(status);
}

/** Activity note for a cancellation whose payment still needs refunding. */
export function refundOwedNote(amount: number): string {
  return (
    `REFUND OWED: Rs ${amount} was already paid for this order. ` +
    `Stock has been returned, but no ledger reversal was made because the ` +
    `payment had already settled the credit. Refund the shop separately.`
  );
}
