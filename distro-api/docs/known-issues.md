# distro-api — known issues

Deliberately-deferred defects, recorded so they don't get rediscovered from
scratch. Each was found while fixing the admin-cancellation reversal bug
(2026-07-28) and judged out of scope for that change.

---

## 0. `POST /orders` has no idempotency key — retries create duplicate orders

**Next piece of work.** Agreed 2026-07-28 to fix separately rather than bundle
into the sales-picker change, because it is an API contract change that needs
its own tests.

`POST /orders` has no client-supplied request id, so the server cannot tell a
retry from a new order. If the order commits but the response is lost, the
client's cart and shop selection are deliberately preserved (correct for a
genuine failure) and the rep retries — producing a second real order against
the shop's credit.

**Why it matters more here than in most systems:** field reps work on patchy
mobile data in shops, so "committed, response lost, retry" is a routine
condition rather than an edge case. The cost is a duplicate order against a
real shop's credit line, which then has to be cancelled and reconciled — and
until the admin-cancel fix (`lib/orderReversal.ts`) that reconciliation was
itself broken.

**Fix shape:** accept an `Idempotency-Key` header (or `clientRequestId` in the
body) generated once per checkout attempt on the client and reused across
retries. Store it on `Order` with a unique index; on a repeat, return the
existing order with 200 instead of creating another. That is a schema change —
one nullable unique column — so it needs a migration.

Client side, the key must be generated when the cart is finalised, **not** per
request, or every retry gets a fresh key and the guard does nothing.

---

## 1. No order status state machine — un-cancelling is broken in both directions

`PATCH /orders/:id/status` and `PATCH /orders/bulk-status` accept any value in
`ORDER_STATUSES` regardless of the order's current status. There is no
transition validation anywhere in the codebase.

The cancellation guard added in `lib/orderReversal.ts` (`canAdminCancel`) blocks
cancelling from `DELIVERED` or `CANCELLED`, but nothing stops the reverse move:
an admin can take a `CANCELLED` order back to `CONFIRMED`.

**Why it matters:** cancelling returns stock and reverses the ledger.
Un-cancelling does *not* re-deduct stock or re-debit the ledger, so the order
becomes live again with its inventory already given back. Verified against the
local API on 2026-07-28: `CANCELLED → CONFIRMED` left `stockQty` at the restored
figure with the order active.

The reversal's idempotency (keyed on the reversing `Ledger` row) means a
*second* cancel after an un-cancel is correctly a no-op, so the damage is
bounded to one un-cancel — but the order is still wrong.

**Fix shape:** an explicit transition table, plus a decision on whether
un-cancelling should be permitted at all. If it is, it needs a `reapplyOrderEffects`
counterpart to `reverseOrderEffects`.

---

## 2. `CONFIRMED` is not idempotent — repeat sets re-send the invoice

`PATCH /orders/:id/status` with `status: 'CONFIRMED'` regenerates the invoice
PDF and re-sends the invoice email every time it is called
(`routes/orders.ts`, the `if (status === 'CONFIRMED')` block). Setting an
already-confirmed order to `CONFIRMED` again — easy to do from a bulk action —
emails the customer a duplicate invoice.

`invoiceEmailSent` is already written on the order but is never read as a guard.

**Fix shape:** skip the pipeline when `order.status === 'CONFIRMED'` already, or
gate the email on `invoiceEmailSent === false`.

Not a data-integrity issue; customer-visible noise only.

---

## 3. Manual ledger entries don't touch `Profile.creditUsed`

`POST /ledger` (`routes/ledger.ts`) writes a `Ledger` row and computes a running
`balance`, but never updates `Profile.creditUsed`. Every other ledger writer —
order creation, cancellation reversal, payment settlement — keeps the two in
step.

**Why it matters:** `creditUsed` is what the credit-limit check reads when
placing an order (`routes/orders.ts`, the `creditUsed + total > creditLimit`
guard). A manual DEBIT that doesn't raise `creditUsed` lets a shop exceed its
limit; a manual CREDIT that doesn't lower it keeps a shop blocked after an
off-system settlement.

**Fix shape:** update `creditUsed` in the same transaction, or make `creditUsed`
a derived read over the ledger rather than a stored column. The latter is the
more durable fix and removes this whole class of desync.
