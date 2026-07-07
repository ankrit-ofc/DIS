import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin } from '../middleware/auth';
import { validateSession } from '../lib/auth';
import { withTransaction } from '../lib/transaction';
import { toBuyerProduct } from '../lib/stock';

const router = Router();

/** Safely extract a scalar string from req.query or req.params (Express 5 types as string | string[]). */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

/**
 * Public product endpoints serve two audiences: admins (raw stockQty, inactive
 * rows) and buyers/guests (stockStatus + maxOrderQty only). Sniff the optional
 * bearer token to decide — no token or non-admin token gets the buyer shape.
 */
async function isAdminRequest(req: Request): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  const profile = await validateSession(auth.split(' ')[1]);
  return profile?.role === 'ADMIN';
}

// ─── Multer setup ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, png, webp images are allowed'));
    }
  },
});

// ─── GET /api/products — public ───────────────────────────────────────────────
function allQueryStrings(req: Request, key: string): string[] {
  const v = req.query[key];
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const categoryId =
    qs(req.query.categoryId as string | string[] | undefined) ??
    qs(req.query.category as string | string[] | undefined);
  const brandList = allQueryStrings(req, 'brand');
  const search     = qs(req.query.search     as string | string[] | undefined);
  const minPrice   =
    qs(req.query.minPrice as string | string[] | undefined) ??
    qs(req.query.priceMin as string | string[] | undefined);
  const maxPrice   =
    qs(req.query.maxPrice as string | string[] | undefined) ??
    qs(req.query.priceMax as string | string[] | undefined);
  const inStock    = qs(req.query.inStock    as string | string[] | undefined);
  const sort       = qs(req.query.sort       as string | string[] | undefined);
  const page       = qs(req.query.page       as string | string[] | undefined);
  const limit      = qs(req.query.limit      as string | string[] | undefined);

  const pageNum  = Math.max(1, parseInt(page  ?? '1')  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20') || 20));
  const skip     = (pageNum - 1) * limitNum;

  const all = qs(req.query.all as string | string[] | undefined);
  const q   = qs(req.query.q   as string | string[] | undefined);

  // Override search with 'q' param (used by admin list)
  const searchTerm = q ?? search;

  // Only admins may see inactive products or raw stock numbers.
  const admin = await isAdminRequest(req);
  const where: Record<string, any> = admin && all === '1' ? {} : { active: true };
  if (categoryId) where.categoryId = categoryId;
  if (brandList.length === 1) where.brand = { contains: brandList[0] };
  else if (brandList.length > 1) where.brand = { in: brandList };
  if (inStock === 'true' || inStock === '1') where.stockQty = { gt: 0 };
  if (minPrice || maxPrice) {
    where.price = {
      ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
      ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
    };
  }
  if (searchTerm) {
    where.OR = [
      { name:  { contains: searchTerm } },
      { brand: { contains: searchTerm } },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: 'desc' };
  if      (sort === 'price_asc')  orderBy = { price: 'asc' };
  else if (sort === 'price_desc') orderBy = { price: 'desc' };
  else if (sort === 'name_asc')   orderBy = { name: 'asc' };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
      select: {
        id: true, name: true, brand: true, sellUnit: true, price: true, mrp: true,
        unit: true, moq: true, piecesPerCarton: true, pricePerCarton: true,
        stockQty: true, imageUrl: true, active: true,
        category: { select: { id: true, name: true, emoji: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const payload = admin ? products : products.map(toBuyerProduct);
  res.json({ products: payload, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// ─── POST /api/products/bulk-price — ADMIN ────────────────────────────────────
router.post(
  '/bulk-price',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { updates } = req.body as {
      updates?: Array<{ id: string; newPrice: number; reason?: string }>;
    };
    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ error: 'updates array is required' });
      return;
    }

    await withTransaction(async (tx) => {
      for (const u of updates) {
        const product = await tx.product.findUnique({ where: { id: u.id } });
        if (!product) throw new Error(`Product ${u.id} not found`);
        await tx.priceHistory.create({
          data: {
            productId: u.id,
            oldPrice:  product.price,
            newPrice:  u.newPrice,
            reason:    u.reason ?? null,
          },
        });
        await tx.product.update({ where: { id: u.id }, data: { price: u.newPrice } });
      }
    });

    res.json({ message: `${updates.length} price(s) updated` });
  },
);

// ─── POST /api/products/upload-image — ADMIN ──────────────────────────────────
router.post(
  '/upload-image',
  requireAuth,
  isAdmin,
  (_req: Request, _res: Response, next: NextFunction) => {
    upload.single('image')(_req, _res, (err: any) => {
      if (err instanceof multer.MulterError) {
        _res.status(400).json({
          error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 2 MB limit' : err.message,
        });
        return;
      }
      if (err) {
        _res.status(400).json({ error: err.message ?? 'Upload failed' });
        return;
      }
      next();
    });
  },
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    const relativePath = `/uploads/${req.file.filename}`;
    // Return both relative (for storage) and absolute (for direct use)
    res.json({ url: relativePath, imageUrl: relativePath });
  },
);

// ─── GET /api/products/price-history/:id — ADMIN ─────────────────────────────
router.get(
  '/price-history/:id',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = qs(req.params.id)!;
    const history = await prisma.priceHistory.findMany({
      where:   { productId: id },
      orderBy: { changedAt: 'desc' },
    });
    res.json({ history });
  },
);

// ─── GET /api/products/:id — public ──────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = qs(req.params.id)!;
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true, name: true, brand: true, sellUnit: true, price: true, mrp: true,
      unit: true, moq: true, piecesPerCarton: true, pricePerCarton: true,
      stockQty: true, imageUrl: true, active: true,
      description: true,
      category: { select: { id: true, name: true, emoji: true } },
    },
  });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }

  const admin = await isAdminRequest(req);
  if (admin) { res.json(product); return; }
  if (!product.active) { res.status(404).json({ error: 'Product not found' }); return; }
  res.json(toBuyerProduct(product));
});

/**
 * Validate + normalize the sellUnit-dependent pricing fields.
 * PIECE  → price (Rs/pc) authoritative, moq in pieces, carton fields nulled.
 * CARTON → piecesPerCarton + pricePerCarton authoritative, moq in cartons
 *          (default 1); legacy `price` is kept as the derived per-piece price
 *          so old clients keep seeing a sane number.
 */
interface PricingData {
  sellUnit: 'PIECE' | 'CARTON';
  price: number;
  moq: number;
  piecesPerCarton: number | null;
  pricePerCarton: number | null;
}

function normalizePricing(body: {
  sellUnit?: string; price?: number; moq?: number;
  piecesPerCarton?: number | null; pricePerCarton?: number | null;
}): { error?: string; data?: PricingData } {
  const sellUnit = body.sellUnit ?? 'PIECE';
  if (!['PIECE', 'CARTON'].includes(sellUnit)) {
    return { error: 'sellUnit must be PIECE or CARTON' };
  }
  if (sellUnit === 'PIECE') {
    if (body.price == null || body.price <= 0) {
      return { error: 'price (Rs per piece) must be a positive number' };
    }
    if (body.moq != null && (!Number.isInteger(body.moq) || body.moq < 1)) {
      return { error: 'moq must be a whole number ≥ 1' };
    }
    return {
      data: {
        sellUnit: 'PIECE',
        price: body.price,
        moq: body.moq ?? 1,
        piecesPerCarton: null,
        pricePerCarton: null,
      },
    };
  }
  // CARTON
  if (body.piecesPerCarton == null || !Number.isInteger(body.piecesPerCarton) || body.piecesPerCarton < 1) {
    return { error: 'piecesPerCarton must be a positive integer' };
  }
  if (body.pricePerCarton == null || body.pricePerCarton <= 0) {
    return { error: 'pricePerCarton must be a positive number' };
  }
  if (body.moq != null && (!Number.isInteger(body.moq) || body.moq < 1)) {
    return { error: 'moq (cartons) must be a whole number ≥ 1' };
  }
  return {
    data: {
      sellUnit: 'CARTON',
      piecesPerCarton: body.piecesPerCarton,
      pricePerCarton: body.pricePerCarton,
      moq: body.moq ?? 1,
      price: Number((body.pricePerCarton / body.piecesPerCarton).toFixed(2)),
    },
  };
}

// ─── POST /api/products — create, ADMIN ──────────────────────────────────────
router.post('/', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const {
    name, brand, description, sku, categoryId, sellUnit,
    price, mrp, unit, moq, piecesPerCarton, pricePerCarton,
    stockQty, imageUrl, active,
  } = req.body as {
    name?: string; brand?: string; description?: string; sku?: string;
    categoryId?: string; sellUnit?: string; price?: number; mrp?: number; unit?: string;
    moq?: number; piecesPerCarton?: number; pricePerCarton?: number;
    stockQty?: number; imageUrl?: string; active?: boolean;
  };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const pricing = normalizePricing({ sellUnit, price, moq, piecesPerCarton, pricePerCarton });
  if (pricing.error) {
    res.status(400).json({ error: pricing.error });
    return;
  }

  const product = await prisma.product.create({
    data: {
      name,
      brand:           brand       ?? null,
      description:     description ?? null,
      sku:             sku         ?? null,
      categoryId:      categoryId  ?? null,
      mrp:             mrp      ?? null,
      unit:            unit     ?? 'piece',
      stockQty:        stockQty ?? 0,
      imageUrl:        imageUrl ?? null,
      active:          active   ?? true,
      ...pricing.data!,
    },
  });
  res.status(201).json({ product });
});

// ─── PUT/PATCH /api/products/:id — update, ADMIN ─────────────────────────────
async function updateProduct(req: Request, res: Response): Promise<void> {
  const id = qs(req.params.id)!;
  const { name, brand, unit, sellUnit, price, mrp, moq, piecesPerCarton, pricePerCarton, stockQty, stock, active, description, imageUrl, image, categoryId } = req.body as {
    name?: string; brand?: string; unit?: string; sellUnit?: string; price?: number; mrp?: number; moq?: number;
    piecesPerCarton?: number | null; pricePerCarton?: number | null;
    stockQty?: number; stock?: number; active?: boolean; description?: string;
    imageUrl?: string; image?: string; categoryId?: string;
  };

  // Accept both field name variants (frontend uses stock/image, API uses stockQty/imageUrl)
  const resolvedStockQty = stockQty ?? stock;
  const resolvedImageUrl = imageUrl ?? image;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  // If any pricing-mode field is touched, re-validate the merged pricing set so
  // a product can never end up half PIECE / half CARTON.
  let pricingData: Record<string, any> = {};
  const touchesPricing =
    sellUnit !== undefined || price !== undefined || moq !== undefined ||
    piecesPerCarton !== undefined || pricePerCarton !== undefined;
  if (touchesPricing) {
    const pricing = normalizePricing({
      sellUnit:        sellUnit ?? existing.sellUnit,
      price:           price ?? existing.price,
      moq:             moq ?? existing.moq,
      piecesPerCarton: piecesPerCarton !== undefined ? piecesPerCarton : existing.piecesPerCarton,
      pricePerCarton:  pricePerCarton !== undefined
        ? pricePerCarton
        : existing.pricePerCarton != null ? Number(existing.pricePerCarton) : null,
    });
    if (pricing.error) {
      res.status(400).json({ error: pricing.error });
      return;
    }
    pricingData = pricing.data!;
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name               !== undefined && { name }),
      ...(brand              !== undefined && { brand }),
      ...(unit               !== undefined && { unit }),
      ...(mrp                !== undefined && { mrp }),
      ...(resolvedStockQty   !== undefined && { stockQty: resolvedStockQty }),
      ...(active             !== undefined && { active }),
      ...(description        !== undefined && { description }),
      ...(resolvedImageUrl   !== undefined && { imageUrl: resolvedImageUrl }),
      ...(categoryId         !== undefined && { categoryId }),
      ...pricingData,
    },
  });
  res.json({ product });
}

router.put('/:id', requireAuth, isAdmin, updateProduct);
router.patch('/:id', requireAuth, isAdmin, updateProduct);

export default router;
