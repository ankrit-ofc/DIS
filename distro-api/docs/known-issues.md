# distro-api — known issues

Deliberately-deferred defects, recorded so they don't get rediscovered from
scratch. Each was found while fixing the admin-cancellation reversal bug
(2026-07-28) and judged out of scope for that change.

**Related:** `reconcile-unreversed-cancellations.sql` in this directory holds
the four read-only queries that measure the historical damage from that bug —
cancelled orders whose stock and credit were never reversed, and which shops
are being wrongly blocked by the resulting phantom credit.

---

## 0. ~~`POST /orders` has no idempotency key~~ — FIXED 2026-08-03

Resolved. `POST /orders` accepts an optional `Idempotency-Key` header (1–64
chars), stored on `Order.idempotencyKey` with a unique index (migration
`20260803000000_add_order_idempotency_key`). A repeat returns the original
order with **200 + `Idempotency-Replayed: true`** instead of creating another;
a fresh order is still 201. The replay returns before the notification block,
so a retry does not re-send the shop's confirmation SMS and email. A key
presented by a different buyer is a 409, since a key is effectively a bearer
token for the order it created.

The unique index — not the pre-flight `SELECT` — is the real guard: two
simultaneous retries both miss the read, and the loser's `P2002` is caught and
converted into a replay of the winner. Existing clients are unaffected: the
column is nullable and MySQL permits unlimited NULLs under a unique index.

Client: `SalesCheckoutScreen` mints one key per checkout attempt into a `useRef`
on first submit, reuses it for retries, and clears it only after a confirmed
success. It deliberately survives a 409 stock rejection — that rolls back, so
the key is still unused.

Covered by `src/routes/__tests__/orderIdempotency.test.ts`. Mobile sales only
for now; web buyer checkout sends no key, and the server accepts that, so web
can adopt it later with no API change.

**Follow-on:** see issue 6 — this does not survive process death.

---

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

---

## 4. `/forgot-password` is email-only — phone-first buyers have no recovery path

Surfaced by the phone-first registration switch (2026-08-04) and deliberately
not fixed in it, to keep that change to one concern.

`POST /auth/forgot-password` takes `{ email }`, looks the profile up by email,
and mails a `PasswordResetCode`. There is no phone equivalent. Registration is
now phone-first with email **optional**, so a buyer who skips email has:

- password login — works, until they forget the password
- OTP login — works, but needs SMS
- password reset — **nothing at all**

So a forgotten password during an SMS outage is an unrecoverable account
without a support call. Sparrow outages are not hypothetical here; the whole
reason email is still collected at all is that we have been burned by one.

This is why `PATCH /me` was extended to accept `email` in the same change: a
buyer who skipped it at signup can at least add one later and get a recovery
path. That is a mitigation, not a fix — it only helps people who think to do it
*before* they are locked out.

**Fix shape:** a phone branch on forgot-password that issues the reset code by
SMS, reusing `PasswordResetCode` and the existing `forgotLimiter`. Note it puts
another SMS-billed endpoint in front of unauthenticated traffic, so it wants
the same cost review as the PENDING-cleanup issue below — and the reset code must not become a cheaper
oracle for "is this number registered" than request-otp already is.

---

---

## 5. PENDING profiles are never cleaned up

Also surfaced by the phone-first switch. Pre-existing, but it matters more now.

`findOrCreateProfile` (`routes/auth.ts`) creates a `status: 'PENDING'` row on
the *first* `request-otp` for an unknown identifier. `lib/cleanup.ts` prunes
expired sessions and OTP codes only — nothing ever deletes an abandoned PENDING
profile, so every signup that stalls after "send code" leaves a permanent row.

Under the old email-first flow those rows held a `PENDING_<ts>_<rand>`
placeholder phone. Phone-first stores the **real** number, so each abandoned
signup now occupies that number's slot on the unique index.

**Why it is not urgent:** the slot is not lost. A returning user hits
`findOrCreateProfile`, matches the existing PENDING row, and completes
registration on it — abandonment is genuinely resumable, which is a feature.
The cost is table growth plus a misleading "profile count".

**Why it is not nothing:** it is the storage half of the abuse surface in the
SMS cost note. `authIpBackstopLimiter` allows 300 requests / 15 min / IP, and
every one of those against a fresh number mints a row. Nothing reclaims them.

**Fix shape:** extend `startCleanupCron` to delete `status = 'PENDING'`
profiles older than N days with no orders and no live OTP codes. Pick N well
past a realistic "came back the next day" window — 30 days, not 1. Must exclude
Google-created PENDING profiles awaiting onboarding (`googleId` set), which are
a different, legitimate state.

---

---

## 6. Idempotency key does not survive process death — the cart doesn't either

Deferred deliberately 2026-08-03 when issue 0 was fixed, to keep that change
small and testable. Decide separately.

The key added in issue 0 lives in a `useRef` in `SalesCheckoutScreen`, so it
dies with the JS context. That is sufficient for the common failure — request
times out, screen still mounted, rep taps "Place order" again — but not for
Android killing the app while the request is in flight.

**The cart has the same lifetime.** `distro-app/src/store/cartStore.ts` is a
plain Zustand store with no `persist` middleware, and `clearLegacyCart()`
actively deletes the old `distro_cart` SecureStore blob ("the cart is in-memory
per session"). So after a process death the rep has lost the cart *and* the key,
and must rebuild the order by hand — for an order that may well have committed.
Rebuilding produces a fresh key, so the guard cannot catch it.

**Why it was left:** fixing it properly means persisting both the cart and the
in-flight key to SecureStore and reconciling on relaunch, which is a materially
bigger change than the header. Reps also lose the cart on process death today
regardless of idempotency, so this is arguably a cart-durability bug that
idempotency merely inherits.

**Fix shape:** persist cart + pending idempotency key to SecureStore on submit;
on relaunch, if a pending key exists, replay `POST /orders` with it — the server
already returns the original order if it committed, and places it if it did not.
That makes relaunch a resume rather than a rebuild.

---

---

## 7. Email-less buyers receive nothing about their own orders

Accepted consequence of the OTP-only SMS decision (2026-08-04), recorded so it
is a known state rather than a surprise. **Not a bug — a deliberate trade.**

`lib/notificationPolicy.ts` routes every order event to `email`. Buyers with no
email address on file therefore get **no order confirmation, no status update
and no cancellation notice** — nothing at all about orders placed for them.

**Who this is:** every shop registered by a SALES rep (`POST /sales/buyers`
collects no email), plus any phone-first self-serve signup that skipped the
optional field. For rep-registered shops this is the norm, not the exception.

**Why it was accepted:** a full order lifecycle cost ~5 SMS (~4.75 NPR) and the
spend was unbounded on chat. The alternative — keeping the confirmation, and
optionally DISPATCHED, on SMS at ~0.95 NPR against a typical Rs 11,000 order —
was put forward and declined in favour of the strict target state.

**What partially covers it:** the rep sees the order number on the confirmation
screen and can read it out; the shop can see orders in the app if they have it;
admin has the full list. None of these reach a shopkeeper who is not looking.

**If it needs revisiting**, flip `order_confirmation` (and/or `order_status`
gated to `DISPATCHED`) back to `'sms'` in `notificationPolicy.ts`. That single
change re-enables the SMS at every call site — no route edits — which is the
reason the policy is a map rather than scattered calls.

Better long-term fix: prompt for an email at first login for accounts that
have none, or drive order notifications through Expo push (already wired for
chat) so the app itself becomes the channel.

---

## Considered and rejected

Decisions recorded so they don't get re-raised. These are **not** bugs.

### `mrp` is sent to buyers over the wire (raised 2026-08-03, rejected)

`GET /products` and `GET /products/:id` select `mrp` for every authenticated
role (`routes/products.ts`), while commit `ce89b95` hid MRP and margin from
buyer-facing *display*. So a buyer can read MRP from the network response and
derive the shopkeeper margin.

**Rejected — nothing private is exposed.** MRP is printed on the product packet
and the buyer already knows what they pay. It was removed from the buyer UI for
clarity, not secrecy: three unlabelled prices in identical grey read as
competing offers. Adding a role-conditional `select` would buy no
confidentiality and would fork the product serializer for no benefit.

Do not "fix" this. If the buyer UI ever needs MRP back, the data is already
there.
