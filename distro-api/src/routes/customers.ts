import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin } from '../middleware/auth';

const router = Router();

/** Safely extract a scalar string from req.query or req.params (Express 5 types both as string | string[]). */
const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

// All customers routes are ADMIN only.

// ─── GET /api/customers — paginated list ─────────────────────────────────────
router.get('/', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const search = qs(req.query.search as string | string[] | undefined);
  const page   = qs(req.query.page   as string | string[] | undefined);
  const limit  = qs(req.query.limit  as string | string[] | undefined);

  const pageNum  = Math.max(1, parseInt(page  ?? '1')  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20') || 20));
  const skip     = (pageNum - 1) * limitNum;

  const where: Record<string, any> = { role: 'BUYER' };
  if (search) {
    where.OR = [
      { storeName: { contains: search } },
      { phone:     { contains: search } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      select: {
        id: true, phone: true, email: true, storeName: true, ownerName: true,
        district: true, address: true, companyName: true, panNumber: true,
        status: true, creditLimit: true, creditUsed: true, createdAt: true,
      },
    }),
    prisma.profile.count({ where }),
  ]);

  res.json({ customers, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// ─── GET /api/customers/:id — full profile + recent orders + notes + ledger ──
router.get('/:id', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = qs(req.params.id)!;

  const customer = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true, phone: true, email: true, storeName: true, ownerName: true,
      district: true, address: true, companyName: true, panNumber: true,
      status: true, role: true, creditLimit: true, creditUsed: true,
      createdAt: true, updatedAt: true,
    },
  });
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const [recentOrders, notes, lastLedgerEntry, totalTransactions, totalAmountAgg] =
    await Promise.all([
      prisma.order.findMany({
        where:   { buyerId: id },
        orderBy: { createdAt: 'desc' },
        take:    10,
        select:  { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      }),
      prisma.customerNote.findMany({
        where:   { buyerId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ledger.findFirst({
        where:   { buyerId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ledger.count({ where: { buyerId: id } }),
      prisma.ledger.aggregate({
        where: { buyerId: id },
        _sum:  { amount: true },
      }),
    ]);

  const ledgerSummary = {
    outstandingBalance: lastLedgerEntry?.balance ?? 0,
    totalTransactions,
    totalAmount:        totalAmountAgg._sum?.amount ?? 0,
  };

  res.json({ customer, recentOrders, notes, ledgerSummary });
});

// ─── PATCH /api/customers/:id/credit — update creditLimit ────────────────────
router.patch(
  '/:id/credit',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = qs(req.params.id)!;
    const { creditLimit } = req.body as { creditLimit?: number };

    if (creditLimit == null || typeof creditLimit !== 'number' || creditLimit < 0) {
      res.status(400).json({ error: 'creditLimit must be a non-negative number' });
      return;
    }

    const customer = await prisma.profile.update({
      where: { id },
      data:  { creditLimit },
      select: { id: true, storeName: true, creditLimit: true, creditUsed: true },
    });
    res.json({ customer });
  },
);

// ─── PATCH /api/customers/:id/status — ACTIVE | SUSPENDED ────────────────────
router.patch(
  '/:id/status',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = qs(req.params.id)!;
    const { status } = req.body as { status?: string };

    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      res.status(400).json({ error: 'status must be ACTIVE or SUSPENDED' });
      return;
    }

    const customer = await prisma.profile.update({
      where: { id },
      data:  { status: status as any },
      select: { id: true, storeName: true, phone: true, status: true },
    });
    res.json({ customer });
  },
);

// ─── POST /api/customers/:id/notes — add internal note ───────────────────────
router.post(
  '/:id/notes',
  requireAuth,
  isAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = qs(req.params.id)!;
    const { note } = req.body as { note?: string };

    if (!note || !note.trim()) {
      res.status(400).json({ error: 'note is required' });
      return;
    }

    const exists = await prisma.profile.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const customerNote = await prisma.customerNote.create({
      data: { buyerId: id, note: note.trim() },
    });
    res.status(201).json({ note: customerNote });
  },
);

export default router;
