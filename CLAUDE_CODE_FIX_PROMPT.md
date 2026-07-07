# Prompt for Claude Code — paste everything below this line

Fix the following issues in this monorepo (distro-api, distro-web). Work in the order given. Follow CLAUDE.md rules: Prisma + MySQL, custom JWT, withTransaction() for all order/payment/stock writes, never commit .env.

---

## PART 1 — Backend fixes (distro-api)

### 1.1 OTP concurrency bug (HIGHEST PRIORITY — users are hitting this now)
Symptom: when multiple users log in concurrently, OTP verification fails with "no match" and then a wait period is applied.

Root causes to fix in `src/routes/auth.ts` and `src/middleware/rateLimiter.ts`:

a) **Rate limits are per-IP.** Many Nepali users share carrier/CGNAT IPs, so one user's attempts consume another user's quota, and `authLimiter` (10 per 15 min per IP) on `/verify-otp` locks out unrelated users. Fix: for `/request-otp`, `/verify-otp`, `/login`, `/forgot-password`, key the limiter by the target identifier instead of raw IP — use `keyGenerator: (req) => (req.body?.email || req.body?.phone || '').toLowerCase().trim() || req.ip`. Keep a generous pure-IP limiter on top as a backstop (e.g. 60/15min).

b) **OTP is stored on the Profile row (`otpCode`) and each `/request-otp` overwrites it.** If a user requests a code twice (slow email/SMS, two devices, double-tap), the first code silently becomes invalid → "no match". Fix: move OTPs to a dedicated table:

```prisma
model OtpCode {
  id        String    @id @default(cuid())
  profileId String
  code      String
  expiresAt DateTime
  usedAt    DateTime?
  attempts  Int       @default(0)
  createdAt DateTime  @default(now())
  profile   Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  @@index([profileId, expiresAt])
}
```

- On verify: accept any unused, unexpired code for that profile (most recent first). Mark `usedAt` on success.
- Add a per-code attempt counter: increment `attempts` on wrong guess, invalidate the code after 5 wrong attempts. This also closes the OTP brute-force hole (OTP verify doubles as passwordless login).
- On request: invalidate codes older than the last 2 so at most 2 codes are live.
- Write a migration; keep `otpCode`/`otpExpiry` columns for now but stop reading/writing them. Update the cleanup cron in `src/lib/cleanup.ts` to purge expired OtpCode rows.

### 1.2 Stock decrement race (src/routes/orders.ts)
The create-order flow checks stock then decrements — two concurrent orders can both pass and drive `stockQty` negative. Replace the unconditional decrement with a conditional one and verify it applied:

```ts
const r = await tx.product.updateMany({
  where: { id: item.productId, stockQty: { gte: piecesNeeded } },
  data:  { stockQty: { decrement: piecesNeeded } },
});
if (r.count === 0) throw new OrderError(400, `Insufficient stock for "${p.name}"`);
```

Also create a `StockMovement` (type OUT) row for each order item, and type IN on cancel, so orders have an audit trail.

### 1.3 Ledger balance race (orders.ts create + cancel, payments.ts both webhooks)
All four writers read the last ledger entry's `balance` then write `last ± amount` — concurrent writes for the same buyer corrupt the running balance. Fix: inside the existing transaction, lock the buyer's profile row first with `await tx.$queryRaw`SELECT id FROM Profile WHERE id = ${buyerId} FOR UPDATE`` before reading the last ledger entry. Apply in all four places.

### 1.4 Enforce creditLimit (orders.ts)
`creditUsed` is incremented on order creation but the limit is never checked. Inside the order transaction (after locking the profile row per 1.3), if the buyer's `creditLimit > 0` and `creditUsed + total > creditLimit`, throw `OrderError(400, 'Credit limit exceeded')`. Treat `creditLimit === 0` as "no limit set" to avoid breaking existing buyers.

### 1.5 Google login audience check (auth.ts /google)
The tokeninfo response is accepted from ANY Google app. After fetching tokeninfo, reject unless `payload.aud` is in the comma-separated env `GOOGLE_CLIENT_IDS`, and reject unless `payload.email_verified` is `true` or `'true'`. Add `GOOGLE_CLIENT_IDS` to `.env.example`.

### 1.6 eSewa amount fields (orders.ts /:id/pay) + webhook amount verification (payments.ts)
- eSewa initiation sends `amount: order.subtotal, tax_amount: 0` but `total_amount: order.total` — components don't sum (VAT missing). Set `tax_amount: order.vat`.
- In both webhooks, before marking PAID, verify the paid amount matches: eSewa `Number(payload.total_amount.replace(/,/g, ''))` equals `order.total`; Khalti `khaltiData.total_amount === Math.round(order.total * 100)`. On mismatch, log and record a Payment row with status UNPAID + rawResponse, return 400.

### 1.7 Smaller fixes
- `orders.ts /:id/cancel`: reject if `order.paymentStatus === 'PAID'` with "Paid orders must be cancelled by support".
- `orders.ts /:id/invoice`: use stored `order.vat` instead of recomputing with hardcoded 0.13.
- `driver.ts /login`: add `authLimiter`.
- Unify password minimum to 8 chars everywhere (register currently allows 6). On `change-password`, delete all other sessions for that profile (keep the current one).
- `orderNumber`: `ORD-${Date.now()}` can collide — append 4 random chars: `ORD-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`.
- `app.ts`: reduce `express.json` limit to `'1mb'`.

Run `npx prisma migrate dev` for schema changes and make sure `npx tsc --noEmit` passes in distro-api when done.

---

## PART 2 — Admin panel UI/UX redesign (distro-web ONLY, admin routes ONLY)

**Scope — touch ONLY these:**
- `src/app/(site)/admin/**` (all admin pages + admin layout)
- `src/components/admin/**` (AdminSidebar, RevenueChart, OrderMapView, etc.)

**DO NOT touch:** the landing page, catalogue, product, cart, checkout, FAQ, about, coverage, buyer pages, auth pages, or any shared component used outside admin. If a shared component is used by admin, create an admin-local variant instead of editing the shared one.

**Design direction — minimal, quiet, non-"AI-generated" look:**
- Palette: white backgrounds (#FFFFFF), one blue (#1A4BDB) used sparingly for primary actions and active nav state, light blue (#E8EFFE) only for subtle active/hover backgrounds, ink (#0D1120) for text, one mid-gray for secondary text and 1px borders (#E5E7EB or similar). Nothing else. No gradients, no glassmorphism, no glow/blur shadows, no purple, no emoji in UI chrome, no decorative icons scattered everywhere.
- Keep existing fonts (Space Grotesk headings/numbers, Plus Jakarta Sans body).
- Flat cards: white, 1px gray border, 6–8px radius, no or minimal shadow.
- Sidebar: white or very light background, plain text nav items, active item = blue text + light-blue background. Small, consistent icon set (lucide) at one size only.
- Tables are the core of this admin: make them dense and scannable — smaller row padding, left-aligned text, right-aligned numbers, gray column headers in uppercase 11–12px, subtle row hover, status shown as plain text with a small colored dot rather than loud pill badges.
- KPI cards on dashboard: number + label only, no icons, no sparkline decorations.
- Buttons: one primary (solid blue), one secondary (white with gray border). No icon-only mystery buttons for destructive actions.
- Charts (RevenueChart): single blue series on white, thin gray gridlines, no gradient fills.
- Remove any animated/gradient/"hero" flourishes inside admin pages.
- Consistent page header pattern on every admin page: page title (left) + primary action (right), then filters row, then table.
- Keep all existing functionality, handlers, and API calls exactly as they are — this is a visual/layout refactor only.

Verify with `npm run build` in distro-web and check that no files outside the two scoped directories were modified (`git diff --stat`).

---

## PART 3 — Verify
1. `npx tsc --noEmit` clean in distro-api; `npm run build` clean in distro-web.
2. Write a quick script or test hitting order creation concurrently (Promise.all x5 on a product with stock for 2) and confirm stock never goes negative and ledger balances stay consistent.
3. Simulate two different users requesting + verifying OTP concurrently and confirm neither gets "no match" or a lockout.
4. `git diff --stat` shows no changes to landing/buyer/auth pages.
