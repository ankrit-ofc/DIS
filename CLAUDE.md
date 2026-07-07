# DISTRO — B2B Wholesale Platform Nepal
Slogan: "Wholesale, made simple."
Single wholesaler. BUYER = shopkeepers. ADMIN = DISTRO staff. No marketplace.

## Monorepo structure
distro-api/   ← Express.js API (port 3001, 127.0.0.1 only)
distro-web/   ← Next.js 14 (port 3000)
distro-app/   ← React Native + Expo

## Stack (FINAL — never suggest alternatives)
ORM: Prisma + MySQL | Auth: Custom JWT + bcryptjs | SMS: Sparrow SMS Nepal
Payments: eSewa + Khalti + COD | Email: Resend | Notifications: WhatsApp → SMS fallback
PDF: PDFKit IRD VAT | Maps: Google Maps API | Mobile storage: expo-secure-store ONLY

## Roles: ADMIN (full access) | BUYER (own data only)

## Design tokens
Blue #1A4BDB | Blue dark #1239B0 | Blue light #E8EFFE
Green #00C46F | Ink #0D1120 | Off-white #F7F9FF
Fonts: Space Grotesk (headings/numbers) | Plus Jakarta Sans (body/buttons)

## Dev credentials
Admin: 9800000000 / admin123 | Buyer: 9841100001 / distro123

## Run commands
API: cd distro-api && npm run dev
Web: cd distro-web && npm run dev
Mobile: cd distro-app && npx expo start

## Never do
- Never use AsyncStorage in mobile (SecureStore only)
- Never bind API to 0.0.0.0 (127.0.0.1 only)
- Never commit .env files
- Never skip withTransaction() for order/payment/stock writes
- All raw SQL and migration SQL must use exact PascalCase table names (e.g. `Product`, `OrderItem`, `Message`) — production MySQL on Railway is case-sensitive; dev XAMPP on Windows is not, so casing bugs pass locally and fail only in production.
