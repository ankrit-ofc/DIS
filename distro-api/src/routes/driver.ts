import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyPassword, createSession } from '../lib/auth';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ─── POST /api/driver/login ──────────────────────────────────────────────────
// Phone + password → JWT. Mirrors the auth.ts password login but is locked to
// DRIVER profiles only, so a buyer/admin password cannot grant driver access.
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { phone, password } = req.body as { phone?: string; password?: string };
  if (!phone || !password) {
    res.status(400).json({ error: 'phone and password are required' });
    return;
  }

  const profile = await prisma.profile.findUnique({ where: { phone } });
  if (!profile || profile.role !== 'DRIVER' || profile.status !== 'ACTIVE') {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (profile.lockedUntil && profile.lockedUntil > new Date()) {
    res.status(429).json({ error: 'Account locked, try again later' });
    return;
  }

  const valid = await verifyPassword(password, profile.passwordHash);
  if (!valid) {
    const attempts = profile.loginAttempts + 1;
    const lockData =
      attempts >= 5
        ? { loginAttempts: attempts, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
        : { loginAttempts: attempts };
    await prisma.profile.update({ where: { id: profile.id }, data: lockData });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { loginAttempts: 0, lockedUntil: null },
  });

  const token = await createSession(profile.id);
  const { passwordHash, otpCode, otpExpiry, ...safe } = profile;
  res.json({ token, profile: safe });
});

// ─── GET /api/driver/orders ──────────────────────────────────────────────────
// Returns confirmed-but-not-delivered orders for the single driver to action.
// Status filter intentionally excludes PENDING (admin hasn't approved yet)
// and DELIVERED / CANCELLED (terminal).
router.get(
  '/orders',
  requireAuth,
  requireRole('DRIVER'),
  async (_req: Request, res: Response): Promise<void> => {
    const orders = await prisma.order.findMany({
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'DISPATCHED'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        buyer: { select: { ownerName: true, storeName: true, phone: true } },
        items: { select: { qty: true } },
      },
    });

    const data = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.buyer.ownerName ?? o.buyer.storeName ?? o.buyer.phone,
      customerPhone: o.buyer.phone,
      deliveryAddress: o.deliveryAddress ?? '',
      deliveryDistrict: o.deliveryDistrict ?? '',
      totalCartons: o.items.reduce((sum, i) => sum + i.qty, 0),
      total: o.total,
      createdAt: o.createdAt,
    }));

    res.json({ orders: data });
  },
);

export default router;
