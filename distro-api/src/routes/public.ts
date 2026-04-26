import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

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
router.get('/districts', async (req: Request, res: Response): Promise<void> => {
  const { active } = req.query as { active?: string };

  const where: Record<string, any> = {};
  if (active === 'true')  where.active = true;
  if (active === 'false') where.active = false;

  const districts = await prisma.district.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  res.json({ districts });
});

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
