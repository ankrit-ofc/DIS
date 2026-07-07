import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { maxOrderQty, moqUnits, stockStatus, unitPrice } from '../lib/stock';

const router = Router();

// ─── POST /api/cart/validate ──────────────────────────────────────────────────
// The cart lives client-side (Zustand / SecureStore) — this endpoint is the
// server-side truth check. Clients call it on cart mount/focus and when adding
// or bumping a line. Returns per-line availability + current price so the UI
// can show "Only N available" / "price changed" warnings with a one-tap fix.
// It never auto-adjusts: B2B buyers decide whether to trim the qty or drop the line.
router.post(
  '/validate',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { items } = req.body as {
      items?: Array<{ productId: string; qty?: number; price?: number }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }
    if (items.length > 100) {
      res.status(400).json({ error: 'Too many items (max 100)' });
      return;
    }

    const productIds = items.map((i) => i?.productId).filter(Boolean) as string[];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines = items.map((item) => {
      const p = item?.productId ? productMap.get(item.productId) : undefined;
      const requested = Number.isInteger(item?.qty) && item.qty! > 0 ? item.qty! : 0;

      if (!p || !p.active) {
        return {
          productId: item?.productId ?? null,
          requested,
          ok: false,
          inactive: true,
          available: 0,
          stockStatus: 'OUT_OF_STOCK' as const,
          priceChanged: false,
        };
      }

      const available = maxOrderQty(p);
      const currentPrice = unitPrice(p);
      const priceChanged =
        item.price != null && Math.abs(Number(item.price) - currentPrice) > 0.009;

      return {
        productId: p.id,
        name: p.name,
        requested,
        ok: requested > 0 && requested <= available && !priceChanged,
        inactive: false,
        available,
        stockStatus: stockStatus(p),
        sellUnit: p.sellUnit,
        moq: moqUnits(p),
        price: currentPrice,
        priceChanged,
      };
    });

    res.json({ lines, ok: lines.every((l) => l.ok) });
  },
);

export default router;
