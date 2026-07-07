import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { requireAuth, isAdmin, requireRole } from '../middleware/auth';

const router = Router();

/** Safely extract a scalar string from req.query or req.params (Express 5 types as string | string[]). */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

const NEPAL_PHONE = /^9[6-8]\d{8}$/;

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

// ─── GET /api/sales/buyers?search= — find shops by name or phone ─────────────
router.get('/buyers', requireAuth, requireRole('SALES', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const search = qs(req.query.search as string | string[] | undefined)?.trim();
  if (!search || search.length < 2) {
    res.json({ buyers: [] });
    return;
  }

  const buyers = await prisma.profile.findMany({
    where: {
      role: 'BUYER',
      status: 'ACTIVE',
      OR: [
        { storeName: { contains: search } },
        { ownerName: { contains: search } },
        { phone:     { contains: search } },
      ],
    },
    orderBy: { storeName: 'asc' },
    take: 20,
    select: {
      id: true, storeName: true, ownerName: true, phone: true,
      district: true, address: true, creditLimit: true, creditUsed: true,
    },
  });
  res.json({ buyers });
});

// ─── POST /api/sales/buyers — quick-create a buyer at the shop door ──────────
// No OTP: the rep is physically at the shop. Creates a normal ACTIVE BUYER
// profile with no password — the owner can later log in via phone OTP.
router.post('/buyers', requireAuth, requireRole('SALES', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { storeName, ownerName, phone, district, address } = req.body as {
    storeName?: string; ownerName?: string; phone?: string; district?: string; address?: string;
  };

  if (!storeName?.trim() || !ownerName?.trim() || !phone || !district) {
    res.status(400).json({ error: 'storeName, ownerName, phone, and district are required' });
    return;
  }
  if (!NEPAL_PHONE.test(phone)) {
    res.status(400).json({ error: 'Valid Nepal phone number required (98XXXXXXXX)' });
    return;
  }

  const districtRow = await prisma.district.findUnique({ where: { name: district } });
  if (!districtRow) {
    res.status(400).json({ error: 'Unknown district' });
    return;
  }

  const taken = await prisma.profile.findUnique({ where: { phone }, select: { id: true } });
  if (taken) {
    res.status(409).json({ error: 'Phone number already in use' });
    return;
  }

  const buyer = await prisma.profile.create({
    data: {
      phone,
      // Empty hash → password login always fails; OTP login works once the
      // shop owner verifies their phone.
      passwordHash: '',
      role: 'BUYER',
      status: 'ACTIVE',
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      district,
      address: address?.trim() || null,
    },
    select: {
      id: true, storeName: true, ownerName: true, phone: true,
      district: true, address: true, creditLimit: true, creditUsed: true,
    },
  });

  res.status(201).json({ buyer });
});

export default router;
