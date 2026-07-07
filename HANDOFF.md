# DISTRO — Codebase Analysis & Fix Handoff
Context document for continuing work in a new chat. Last updated: 2026-07-07.

## 1. Project overview

DISTRO is a B2B wholesale platform for Nepal ("Wholesale, made simple"). Single wholesaler model: BUYER = shopkeepers, ADMIN = DISTRO staff, plus a DRIVER role. No marketplace.

**Monorepo:**
- `distro-api/` — Express 5 + TypeScript API, port 3001. Prisma + MySQL, custom JWT + bcryptjs sessions (JWT + Session DB row, 30-day expiry), Sparrow SMS, Resend email (react-email templates), eSewa + Khalti + COD payments, PDFKit IRD VAT invoices, multer image uploads to `/uploads`, SSE for chat, Expo push notifications.
- `distro-web/` — Next.js 14 (App Router), port 3000. Zustand stores (`authStore`, `cartStore`), token in localStorage + non-httpOnly `distro-token`/`distro-role` cookies used only by `src/middleware.ts` for route gating (API enforces real authz). Route groups: `(auth)`, `(site)` with buyer pages + `/admin/*` (15 pages), `(driver)`.
- `distro-app/` — React Native + Expo, buyer-only. expo-secure-store for tokens (no AsyncStorage anywhere — verified).

**Key API routes:** auth (OTP via email/phone, password login, Google sign-in, forgot/reset), products, orders (create/cancel/status/invoice/pay/reorder), payments (eSewa GET redirect webhook with HMAC check, Khalti POST webhook with server lookup), customers, ledger (running-balance DEBIT/CREDIT per buyer), inventory, admin (stats/banners/categories/announcements), chat, driver, public, reports.

**Domain model notes:** Product has legacy per-piece fields (`price`, `moq`, `unit` — mobile app) and authoritative carton fields (`piecesPerCarton`, `pricePerCarton` Decimal — web). `stockQty` is in pieces; order `qty` is cartons. Order create: validate → delivery fee from District → subtotal → VAT (env `VAT_RATE`, default 0.13) → create Order + OrderItems (price snapshots) → decrement stock → Ledger DEBIT → increment `Profile.creditUsed`. Min order Rs 10,000. Buyer can cancel PENDING orders within 30 min. Account deletion = PII scrub + SUSPEND (kept for VAT records). Dev creds: admin 9800000000/admin123, buyer 9841100001/distro123.

## 2. Code review findings (original state)

**Critical (all now FIXED, see §3):**
1. Stock check-then-decrement race in order creation → negative stock under concurrency.
2. Ledger running balance computed by reading last entry then writing — race in 4 places (order create, cancel, both payment webhooks).
3. `creditLimit` settable by admin but never enforced at order time.
4. Google login accepted any Google ID token — no `aud` (client ID) or `email_verified` check.
5. eSewa initiation sent `amount: subtotal, tax_amount: 0, total_amount: total` (components didn't sum — VAT missing); webhooks didn't verify paid amount vs order total.
6. OTP concurrency glitch (user-reported): (a) rate limiters keyed per-IP — Nepali CGNAT means users share IPs and lock each other out; (b) OTP stored in single `Profile.otpCode` column, overwritten on every request → re-request invalidated the code already in transit ("no match").

**Should-fix (all now FIXED):** buyer could cancel PAID orders (no refund logic); `/orders/:id/invoice` hardcoded 0.13 VAT instead of stored `order.vat`; `/driver/login` had no rate limiter; password min 6 on register vs 8 elsewhere; `change-password` didn't revoke other sessions; no OTP guess limit (OTP verify doubles as passwordless login → ATO surface); `orderNumber = ORD-${Date.now()}` collision risk; `express.json` limit 10mb; no StockMovement rows from orders.

**Still OPEN (not yet fixed):**
- Money stored as `Float` (subtotal/total/Ledger.amount etc.) — should be Decimal for a VAT-invoicing system. `pricePerCarton` is already Decimal.
- No tests (except the new `distro-api/scripts/verify-concurrency.ts` script).
- Web token in localStorage (XSS-readable); `distro-role` cookie is client-forgeable — middleware gating is cosmetic only (API enforces roles). Consider httpOnly cookies later.
- Upload filename extension taken from `originalname` (mimetype filtered, admin-only — low risk, validate extension anyway).
- `app.ts` binds `0.0.0.0` in production, contradicting CLAUDE.md's "127.0.0.1 only" rule — reconcile rule vs deployment.
- Sessions are JWT + DB row (redundant double expiry — harmless).
- Junk files committed at root: `distro (2).html`, `distro-catalogue (2).html`, `distro-faq (1).html`, `.gitignore.tmp.*`, `src/routes/auth.ts.tmp.*`, `distro-web/src/lib/utils.ts.tmp.*`, `trial/`.
- Rate limiters are in-memory — fine for single instance, use a store if scaling out.

## 3. Fixes applied (via Claude Code, verified by spot-check)

**Backend (distro-api):**
- OTP: new `OtpCode` table (code, expiresAt, usedAt, attempts) — last 2 codes stay valid, dead after 5 wrong guesses, cleanup cron purges. Legacy `otpCode`/`otpExpiry` columns remain but unused.
- Rate limiting: auth endpoints keyed by target email/phone (`keyGenerator: identifierKey`) with a pure-IP backstop limiter (60/15min, `authIpBackstopLimiter`). Driver login now rate-limited.
- Stock: conditional `updateMany({ where: { id, stockQty: { gte: piecesNeeded } } })`, throws if count 0; StockMovement OUT on order, IN on cancel.
- Ledger/credit: all writers lock via raw `SELECT ... FOR UPDATE` on Profile AND use locking raw reads for last balance (plain reads inside MySQL REPEATABLE READ still saw pre-lock snapshots — proven by test). 7 `FOR UPDATE` sites across orders.ts (4) and payments.ts (3).
- Credit limit enforced in order transaction (`creditLimit === 0` = unlimited).
- Google login: rejects unless `payload.aud` ∈ `GOOGLE_CLIENT_IDS` (fallback `GOOGLE_CLIENT_ID`) and email verified. Env added to `.env.example`.
- eSewa sends `tax_amount: order.vat`; both webhooks verify gateway amount vs `order.total` (Khalti in paisa), on mismatch log + record UNPAID Payment row + 400.
- Cancel rejects PAID orders; invoice uses stored `order.vat`/`order.total`; password min 8 everywhere; change-password revokes other sessions; orderNumber gets 4-char random suffix; json limit 1mb.
- Migrations applied (two hand-edited old migrations had checksum mismatches — checksums re-synced rather than resetting dev data; two older pending migrations also applied).

**Admin UI (distro-web, scoped to `src/app/(site)/admin/**` + `src/components/admin/**` only):**
Redesigned minimal/non-AI look: white surfaces, single blue #1A4BDB for primary actions/active nav, #E8EFFE for subtle active states, ink #0D1120 text, 1px gray borders, 6–8px radii, no gradients/glass/glow, dense tables (11px uppercase gray headers, right-aligned numbers), status = colored dot + plain text (not pills), KPI cards = number + label only, single-blue charts. Landing/buyer/auth pages untouched (verified: only line-ending churn outside admin, zero content diff).

**Verification done:** `tsc --noEmit` clean (api), `next build` clean (web). `scripts/verify-concurrency.ts`: 5 concurrent orders vs stock-for-2 → exactly 2 succeed, stock 0, ledger consistent; concurrent OTP for 2 users both pass; older code still valid after re-request; code dies after 5 wrong guesses.

## 4. Outstanding action items

1. Clean CRLF churn before committing: `git stash push -- 'src/app/(site)/admin' 'src/components/admin'` in distro-web → `git checkout -- .` → `git stash pop`; add root `.gitattributes` with `* text=auto`.
2. Set `GOOGLE_CLIENT_IDS` in production env (Google login rejects without it).
3. Run migration on other environments; one real eSewa + Khalti sandbox transaction end-to-end (amount fields changed).
4. Consider the OPEN items in §2 (Float→Decimal money is the biggest).
5. XAMPP mysqld was left running locally after testing.

## 5. Design tokens (for any UI work)
Blue #1A4BDB · Blue dark #1239B0 · Blue light #E8EFFE · Green #00C46F · Ink #0D1120 · Off-white #F7F9FF. Fonts: Space Grotesk (headings/numbers), Plus Jakarta Sans (body). Stack is FINAL per CLAUDE.md — never suggest alternatives. Never: AsyncStorage on mobile, committing .env, skipping withTransaction() for order/payment/stock writes.
