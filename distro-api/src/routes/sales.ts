import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { requireAuth, isAdmin, requireRole } from '../middleware/auth';
import { validateCoords } from '../lib/geo';
import { validateActiveDistrict } from '../lib/districts';

/** Fields the sales portal needs about a buyer (search, create, update). */
const BUYER_SELECT = {
  id: true, storeName: true, ownerName: true, phone: true,
  district: true, address: true, latitude: true, longitude: true,
  creditLimit: true, creditUsed: true, panNumber: true,
} as const;

const router = Router();

/** Safely extract a scalar string from req.query or req.params (Express 5 types as string | string[]). */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

const NEPAL_PHONE = /^9[6-8]\d{8}$/;

// Nepal PAN: exactly 9 digits. Kept byte-identical to the buyer-facing paths in
// auth.ts (register / PATCH me / complete-profile) and distro-web's register,
// onboarding and account forms — a rep-created shop must not end up with a PAN
// the buyer's own account page would reject.
const PAN_NUMBER = /^\d{9}$/;

// ════════════════════════════════════════════════════════════════════════════
// ADMIN — Sales team management. SALES accounts are ADMIN-CREATED ONLY; no
// self-registration path can produce a SALES role.
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /api/sales/reps — list reps + this-month order stats ────────────────
router.get('/reps', requireAuth, isAdmin, async (_req: Request, res: Response): Promise<void> => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const reps = await prisma.profile.findMany({
    where: { role: 'SALES' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, ownerName: true, email: true, phone: true, status: true, createdAt: true,
    },
  });

  const stats = await prisma.order.groupBy({
    by: ['salesRepId'],
    where: {
      salesRepId: { in: reps.map((r) => r.id) },
      createdAt: { gte: monthStart },
      status: { not: 'CANCELLED' },
    },
    _count: { _all: true },
    _sum: { total: true },
  });
  const statMap = new Map(stats.map((s) => [s.salesRepId, s]));

  res.json({
    reps: reps.map((r) => ({
      ...r,
      ordersThisMonth: statMap.get(r.id)?._count._all ?? 0,
      valueThisMonth: statMap.get(r.id)?._sum.total ?? 0,
    })),
  });
});

// ─── POST /api/sales/reps — create rep (ADMIN only) ──────────────────────────
router.post('/reps', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, phone, email, password } = req.body as {
    name?: string; phone?: string; email?: string; password?: string;
  };

  if (!name?.trim() || !phone || !email || !password) {
    res.status(400).json({ error: 'name, phone, email, and password are required' });
    return;
  }
  if (!NEPAL_PHONE.test(phone)) {
    res.status(400).json({ error: 'Valid Nepal phone number required (98XXXXXXXX)' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email address required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const taken = await prisma.profile.findFirst({
    where: { OR: [{ phone }, { email }] },
    select: { phone: true },
  });
  if (taken) {
    res.status(409).json({ error: taken.phone === phone ? 'Phone number already in use' : 'Email already in use' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const rep = await prisma.profile.create({
    data: {
      phone,
      email,
      passwordHash,
      role: 'SALES',
      status: 'ACTIVE',
      ownerName: name.trim(),
      emailVerified: true,
      phoneVerified: true,
    },
    select: { id: true, ownerName: true, email: true, phone: true, status: true, createdAt: true },
  });

  res.status(201).json({ rep });
});

// ─── PATCH /api/sales/reps/:id/status — suspend / reactivate ─────────────────
router.patch('/reps/:id/status', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = qs(req.params.id)!;
  const { status } = req.body as { status?: string };

  if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
    res.status(400).json({ error: 'status must be ACTIVE or SUSPENDED' });
    return;
  }

  const rep = await prisma.profile.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!rep || rep.role !== 'SALES') {
    res.status(404).json({ error: 'Sales rep not found' });
    return;
  }

  const [updated] = await prisma.$transaction([
    prisma.profile.update({
      where: { id },
      data: { status: status as any },
      select: { id: true, ownerName: true, phone: true, status: true },
    }),
    // Suspension must bite immediately — kill live sessions.
    ...(status === 'SUSPENDED'
      ? [prisma.session.deleteMany({ where: { profileId: id } })]
      : []),
  ]);
  res.json({ rep: updated });
});

// ─── POST /api/sales/reps/:id/reset-password ─────────────────────────────────
router.post('/reps/:id/reset-password', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = qs(req.params.id)!;
  const { password } = req.body as { password?: string };

  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const rep = await prisma.profile.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!rep || rep.role !== 'SALES') {
    res.status(404).json({ error: 'Sales rep not found' });
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.profile.update({ where: { id }, data: { passwordHash, loginAttempts: 0, lockedUntil: null } }),
    // Force fresh sign-in everywhere after an admin reset.
    prisma.session.deleteMany({ where: { profileId: id } }),
  ]);
  res.json({ message: 'Password reset' });
});

// ─── GET /api/sales/reps/:id/orders — recent orders placed by this rep ───────
router.get('/reps/:id/orders', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = qs(req.params.id)!;
  const orders = await prisma.order.findMany({
    where: { salesRepId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, orderNumber: true, status: true, total: true, createdAt: true,
      buyer: { select: { storeName: true, phone: true } },
    },
  });
  res.json({ orders });
});

// ════════════════════════════════════════════════════════════════════════════
// SALES rep portal — scoped strictly to the rep's own activity.
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /api/sales/summary — rep's orders placed today ──────────────────────
router.get('/summary', requireAuth, requireRole('SALES'), async (req: Request, res: Response): Promise<void> => {
  const rep = (req as any).profile as { id: string };
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const agg = await prisma.order.aggregate({
    where: { salesRepId: rep.id, createdAt: { gte: dayStart }, status: { not: 'CANCELLED' } },
    _count: { _all: true },
    _sum: { total: true },
  });

  res.json({ today: { orders: agg._count._all, value: agg._sum.total ?? 0 } });
});

// ─── GET /api/sales/buyers?search=&page=&limit= — browse or search shops ─────
// With no (or too short) a search term this browses every active buyer rather
// than returning nothing: a rep standing in a shop must be able to find it
// without already knowing its name, and previously an empty term produced an
// empty picker with no way forward.
//
// Deliberately NOT scoped to the rep's own shops or districts. The search has
// always been global for any SALES/ADMIN session, and there is no rep-territory
// model in the schema — scoping browse while search stayed global would just be
// incoherent. Reps also cover for each other.
const BUYER_PAGE_DEFAULT = 20;
const BUYER_PAGE_MAX = 50;

router.get('/buyers', requireAuth, requireRole('SALES', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const search = qs(req.query.search as string | string[] | undefined)?.trim();
  const page = Math.max(1, Number(qs(req.query.page as string | string[] | undefined)) || 1);
  const limit = Math.min(
    BUYER_PAGE_MAX,
    Math.max(1, Number(qs(req.query.limit as string | string[] | undefined)) || BUYER_PAGE_DEFAULT),
  );

  // Short terms fall through to browse rather than returning nothing — a
  // one-character query is a rep who has started typing, not a request for an
  // empty screen.
  const filtering = !!search && search.length >= 2;
  const where = {
    role: 'BUYER' as const,
    status: 'ACTIVE' as const,
    ...(filtering
      ? {
          OR: [
            { storeName: { contains: search } },
            { ownerName: { contains: search } },
            { phone:     { contains: search } },
            // Reps often know where a shop is, not what it is called.
            { address:   { contains: search } },
            { district:  { contains: search } },
          ],
        }
      : {}),
  };

  const [buyers, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      orderBy: { storeName: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: BUYER_SELECT,
    }),
    prisma.profile.count({ where }),
  ]);

  res.json({ buyers, total, page, hasMore: page * limit < total });
});

// ─── POST /api/sales/buyers — quick-create a buyer at the shop door ──────────
// No OTP: the rep is physically at the shop. Creates a normal ACTIVE BUYER
// profile with no password — the owner can later log in via phone OTP.
router.post('/buyers', requireAuth, requireRole('SALES', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { storeName, ownerName, phone, district, address, panNumber, latitude, longitude } = req.body as {
    storeName?: string; ownerName?: string; phone?: string; district?: string; address?: string;
    panNumber?: string; latitude?: number; longitude?: number;
  };

  if (!storeName?.trim() || !phone || !district) {
    res.status(400).json({ error: 'storeName, phone, and district are required' });
    return;
  }
  if (!NEPAL_PHONE.test(phone)) {
    res.status(400).json({ error: 'Valid Nepal phone number required (98XXXXXXXX)' });
    return;
  }

  // PAN is optional. Absent, empty, or whitespace-only all mean "the rep skipped
  // it" and must store NULL — not '', which would collide on Profile.panNumber's
  // unique index for the second such shop.
  const pan = panNumber?.trim() || null;
  if (pan && !PAN_NUMBER.test(pan)) {
    res.status(400).json({ error: 'PAN number must be exactly 9 digits' });
    return;
  }
  // Location is optional, but a supplied pin must be plausible.
  if (latitude != null || longitude != null) {
    const coordError = validateCoords(latitude, longitude);
    if (coordError) {
      res.status(400).json({ error: coordError });
      return;
    }
  }

  const districtError = await validateActiveDistrict(district);
  if (districtError) {
    res.status(400).json({ error: districtError });
    return;
  }

  const taken = await prisma.profile.findUnique({ where: { phone }, select: { id: true } });
  if (taken) {
    res.status(409).json({ error: 'Phone number already in use' });
    return;
  }

  if (pan) {
    const panTaken = await prisma.profile.findUnique({ where: { panNumber: pan }, select: { id: true } });
    if (panTaken) {
      res.status(409).json({ error: 'PAN number already in use' });
      return;
    }
  }

  let buyer;
  try {
    buyer = await prisma.profile.create({
      data: {
        phone,
        // Empty hash → password login always fails; OTP login works once the
        // shop owner verifies their phone.
        passwordHash: '',
        role: 'BUYER',
        status: 'ACTIVE',
        storeName: storeName.trim(),
        ownerName: ownerName?.trim() || null,
        district,
        address: address?.trim() || null,
        panNumber: pan,
        ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
      },
      select: BUYER_SELECT,
    });
  } catch (err) {
    // The findUnique checks above are advisory: two reps registering the same
    // shop at once both pass them, then one INSERT loses on the unique index.
    // Same class of race as findOrCreateProfile's P2002 in auth.ts — report the
    // conflict as 409 rather than letting it surface as a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[])
        : [String(err.meta?.target ?? '')];
      if (target.some((t) => t.includes('panNumber'))) {
        res.status(409).json({ error: 'PAN number already in use' });
        return;
      }
      res.status(409).json({ error: 'Phone number already in use' });
      return;
    }
    throw err;
  }

  res.status(201).json({ buyer });
});

// ─── PATCH /api/sales/buyers/:id — update a buyer's address / location ───────
// Used by "Save as shop's new address" at field checkout and "Set location"
// for existing shops. SALES/ADMIN only; buyers update themselves via /auth/me.
router.patch('/buyers/:id', requireAuth, requireRole('SALES', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const id = qs(req.params.id)!;
  const { district, address, latitude, longitude } = req.body as {
    district?: string; address?: string; latitude?: number; longitude?: number;
  };

  const target = await prisma.profile.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target || target.role !== 'BUYER') {
    res.status(404).json({ error: 'Buyer not found' });
    return;
  }

  const data: Record<string, unknown> = {};
  if (district !== undefined) {
    const districtError = await validateActiveDistrict(district);
    if (districtError) {
      res.status(400).json({ error: districtError });
      return;
    }
    data.district = district;
  }
  if (address !== undefined) data.address = address.trim() || null;
  if (latitude !== undefined || longitude !== undefined) {
    const coordError = validateCoords(latitude, longitude);
    if (coordError) {
      res.status(400).json({ error: coordError });
      return;
    }
    data.latitude = latitude;
    data.longitude = longitude;
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  const buyer = await prisma.profile.update({ where: { id }, data, select: BUYER_SELECT });
  res.json({ buyer });
});

// ─── GET /api/sales/orders?date=YYYY-MM-DD — rep's own orders for a day ──────
router.get('/orders', requireAuth, requireRole('SALES'), async (req: Request, res: Response): Promise<void> => {
  const rep = (req as any).profile as { id: string };
  const dateStr = qs(req.query.date as string | string[] | undefined);

  // Default: today. An explicit date must be valid ISO (YYYY-MM-DD).
  const dayStart = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (Number.isNaN(dayStart.getTime())) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const orders = await prisma.order.findMany({
    where: { salesRepId: rep.id, createdAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, orderNumber: true, status: true, total: true, createdAt: true,
      // paymentMethod matters in the field: a rep settling up at the door needs
      // to tell a cash drop from one booked against the shop's credit.
      paymentMethod: true,
      buyer: { select: { storeName: true, phone: true } },
    },
  });
  res.json({ orders });
});

// ─── GET /api/sales/recent-buyers — distinct shops from the rep's last orders ─
router.get('/recent-buyers', requireAuth, requireRole('SALES'), async (req: Request, res: Response): Promise<void> => {
  const rep = (req as any).profile as { id: string };

  // Walk recent orders newest-first and keep the first occurrence of each buyer.
  const recent = await prisma.order.findMany({
    where: { salesRepId: rep.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { buyer: { select: BUYER_SELECT } },
  });

  const seen = new Set<string>();
  const buyers: Array<(typeof recent)[number]['buyer']> = [];
  for (const { buyer } of recent) {
    if (seen.has(buyer.id)) continue;
    seen.add(buyer.id);
    buyers.push(buyer);
    if (buyers.length >= 6) break;
  }
  res.json({ buyers });
});

export default router;
