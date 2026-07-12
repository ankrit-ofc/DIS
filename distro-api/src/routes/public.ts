import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin } from '../middleware/auth';
import { validateSession } from '../lib/auth';

const router = Router();

/** Optional-auth sniff: true only when the bearer token belongs to an ADMIN. */
async function isAdminRequest(req: Request): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  const profile = await validateSession(auth.split(' ')[1]);
  return profile?.role === 'ADMIN';
}

// ─── GET /api/announcements — active announcements within date range ──────────
router.get('/announcements', async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: {
      active: true,
      OR: [
        { startsAt: null },
        { startsAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endsAt: null },
            { endsAt: { gte: now } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ announcements });
});

// ─── GET /api/districts — delivery districts with fees ───────────────────────
// Default (and any non-admin caller): active districts only, so every dropdown
// in the product shows just the served area. Admins may pass ?all=1 to manage
// the full list, or ?active=false to see only inactive rows.
router.get('/districts', async (req: Request, res: Response): Promise<void> => {
  const { active, all } = req.query as { active?: string; all?: string };

  const admin = await isAdminRequest(req);
  let where: Record<string, any> = { active: true };
  if (admin) {
    if (all === '1' || all === 'true') where = {};
    else if (active === 'false')       where = { active: false };
  }

  const districts = await prisma.district.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  res.json({ districts });
});

// ─── PATCH /api/districts/:id — ADMIN: toggle active / edit fee & ETA ────────
router.patch(
  '/districts/:id',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
    const { active, deliveryFee, estimatedDays } = req.body as {
      active?: boolean; deliveryFee?: number; estimatedDays?: number;
    };

    const existing = await prisma.district.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'District not found' });
      return;
    }
    if (deliveryFee !== undefined && (typeof deliveryFee !== 'number' || deliveryFee < 0)) {
      res.status(400).json({ error: 'deliveryFee must be a non-negative number' });
      return;
    }
    if (estimatedDays !== undefined && (!Number.isInteger(estimatedDays) || estimatedDays < 1)) {
      res.status(400).json({ error: 'estimatedDays must be a whole number ≥ 1' });
      return;
    }

    const district = await prisma.district.update({
      where: { id },
      data: {
        ...(active        !== undefined && { active }),
        ...(deliveryFee   !== undefined && { deliveryFee }),
        ...(estimatedDays !== undefined && { estimatedDays }),
      },
    });
    res.json({ district });
  },
);

// ─── GET /api/categories — top-level categories + children, with product counts ─
router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.category.findMany({
    where: { parentId: null },
    include: {
      children: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  });

  const categories = rows.map((c) => {
    const childProductSum = c.children.reduce(
      (sum, ch) => sum + ch._count.products,
      0
    );
    const productCount = c._count.products + childProductSum;
    return { ...c, productCount };
  });

  res.json({ categories });
});

// ─── GET /api/brands — distinct product brands (for catalogue filters) ───────
router.get('/brands', async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.product.findMany({
    where:   { active: true, brand: { not: null } },
    select:  { brand: true },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  });
  const names = rows
    .map((r) => r.brand)
    .filter((b): b is string => typeof b === 'string' && b.length > 0);
  const brands = names.map((name, i) => ({ id: i + 1, name }));
  res.json({ brands });
});

// ─── GET /api/banners — active banners ordered by sortOrder ──────────────────
router.get('/banners', async (_req: Request, res: Response): Promise<void> => {
  const banners = await prisma.banner.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ banners });
});

export default router;
