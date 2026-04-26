import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin } from '../middleware/auth';

// ─── Multer for banner images ─────────────────────────────────────────────────
const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `banner-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, png, webp images are allowed'));
    }
  },
});

// ─── Multer for category images ───────────────────────────────────────────────
const categoryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `category-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, png, webp images are allowed'));
    }
  },
});

const router = Router();

/** Safely extract a scalar string from req.query. */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

// ─── GET /api/admin/stats — ADMIN dashboard KPIs ─────────────────────────────
router.get('/stats', requireAuth, isAdmin, async (_req: Request, res: Response): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayOrders, todayRevenueAgg, pendingOrders, lowStockItems] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.product.count({ where: { active: true, stockQty: { lte: 5 } } }),
  ]);

  res.json({
    todayOrders,
    todayRevenue: todayRevenueAgg._sum?.total ?? 0,
    pendingOrders,
    lowStockItems,
  });
});

// ─── GET /api/admin/email-logs — ADMIN ───────────────────────────────────────
router.get('/email-logs', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const type   = qs(req.query.type   as string | string[] | undefined);
  const status = qs(req.query.status as string | string[] | undefined);
  const page   = qs(req.query.page   as string | string[] | undefined);
  const limit  = qs(req.query.limit  as string | string[] | undefined);

  const pageNum  = Math.max(1, parseInt(page  ?? '1')  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20') || 20));
  const skip     = (pageNum - 1) * limitNum;

  const where: Record<string, any> = {};
  if (type)   where.type   = type;
  if (status) where.status = status;

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      select: {
        id: true, to: true, subject: true, type: true,
        status: true, messageId: true, createdAt: true,
      },
    }),
    prisma.emailLog.count({ where }),
  ]);

  res.json({ logs, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// ─── Announcements CRUD ───────────────────────────────────────────────────────
router.get('/announcements', requireAuth, isAdmin, async (_req: Request, res: Response): Promise<void> => {
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ announcements });
});

router.post('/announcements', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const { text, active = true } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: 'text is required' }); return; }
  const announcement = await prisma.announcement.create({ data: { text: text.trim(), active } });
  res.status(201).json({ announcement });
});

router.patch('/announcements/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const { text, active } = req.body;
  const data: Record<string, any> = {};
  if (text !== undefined) data.text = text.trim();
  if (active !== undefined) data.active = active;
  const announcement = await prisma.announcement.update({ where: { id: String(req.params.id) }, data });
  res.json({ announcement });
});

router.delete('/announcements/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  await prisma.announcement.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

// ─── Banners CRUD ─────────────────────────────────────────────────────────────
router.get('/banners', requireAuth, isAdmin, async (_req: Request, res: Response): Promise<void> => {
  const banners = await prisma.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  res.json({ banners });
});

router.post('/banners/upload-image', requireAuth, isAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    bannerUpload.single('image')(req, res, (err: any) => {
      if (err instanceof multer.MulterError || err) {
        res.status(400).json({ error: err.message }); return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) { res.status(400).json({ error: 'No image provided' }); return; }
    res.json({ url: `/uploads/${req.file.filename}` });
  }
);

router.post('/banners', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const { title, subtitle, imageUrl, bgColor, textColor, sortOrder, active } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: 'title is required' }); return; }
  const banner = await prisma.banner.create({
    data: {
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      imageUrl: imageUrl || null,
      bgColor: bgColor || '#1A4BDB',
      textColor: textColor || '#FFFFFF',
      sortOrder: sortOrder ?? 0,
      active: active ?? true,
    },
  });
  res.status(201).json({ banner });
});

router.patch('/banners/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const { title, subtitle, imageUrl, bgColor, textColor, sortOrder, active } = req.body;
  const data: Record<string, any> = {};
  if (title !== undefined)     data.title     = title.trim();
  if (subtitle !== undefined)  data.subtitle  = subtitle?.trim() || null;
  if (imageUrl !== undefined)  data.imageUrl  = imageUrl || null;
  if (bgColor !== undefined)   data.bgColor   = bgColor;
  if (textColor !== undefined) data.textColor = textColor;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (active !== undefined)    data.active    = active;
  const banner = await prisma.banner.update({ where: { id: String(req.params.id) }, data });
  res.json({ banner });
});

router.delete('/banners/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  await prisma.banner.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

// ─── Categories CRUD ──────────────────────────────────────────────────────────
router.get('/categories', requireAuth, isAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { products: true, children: true } },
    },
  });
  const categories = rows.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    imageUrl: c.imageUrl,
    description: c.description,
    parentId: c.parentId,
    parentName: c.parent?.name ?? null,
    productCount: c._count.products,
    childCount: c._count.children,
  }));
  res.json({ categories });
});

router.post('/categories/upload-image', requireAuth, isAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    categoryUpload.single('image')(req, res, (err: any) => {
      if (err instanceof multer.MulterError || err) {
        res.status(400).json({ error: err.message }); return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) { res.status(400).json({ error: 'No image provided' }); return; }
    res.json({ url: `/uploads/${req.file.filename}` });
  }
);

router.post('/categories', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, emoji, imageUrl, description, parentId } = req.body as {
    name?: string; emoji?: string; imageUrl?: string | null; description?: string | null; parentId?: string | null;
  };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }

  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) { res.status(400).json({ error: 'parent category not found' }); return; }
  }

  const category = await prisma.category.create({
    data: {
      name: name.trim(),
      emoji: emoji?.trim() || null,
      imageUrl: imageUrl || null,
      description: description?.trim() || null,
      parentId: parentId || null,
    },
  });
  res.status(201).json({ category });
});

router.patch('/categories/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { name, emoji, imageUrl, description, parentId } = req.body as {
    name?: string; emoji?: string | null; imageUrl?: string | null; description?: string | null; parentId?: string | null;
  };

  if (parentId && parentId === id) {
    res.status(400).json({ error: 'category cannot be its own parent' }); return;
  }
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) { res.status(400).json({ error: 'parent category not found' }); return; }
  }

  const data: Record<string, any> = {};
  if (name !== undefined)        data.name        = name.trim();
  if (emoji !== undefined)       data.emoji       = emoji?.toString().trim() || null;
  if (imageUrl !== undefined)    data.imageUrl    = imageUrl || null;
  if (description !== undefined) data.description = description?.toString().trim() || null;
  if (parentId !== undefined)    data.parentId    = parentId || null;

  const category = await prisma.category.update({ where: { id }, data });
  res.json({ category });
});

router.delete('/categories/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const [productCount, childCount] = await Promise.all([
    prisma.product.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (productCount > 0) {
    res.status(400).json({ error: `Cannot delete: ${productCount} product(s) are in this category` }); return;
  }
  if (childCount > 0) {
    res.status(400).json({ error: `Cannot delete: ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'} use this as parent` }); return;
  }
  await prisma.category.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
