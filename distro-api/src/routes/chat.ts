import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, isAdmin } from '../middleware/auth';
import { validateSession } from '../lib/auth';
import { sendNotification } from '../lib/notifications';
import {
  addClient, removeClient,
  sendToClient, sendToAllAdmins,
  hasAdminConnected, hasBuyerConnected,
} from '../lib/sse';

const router = Router();

const qs = (v: string | string[] | undefined): string | undefined =>
  typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

// ─── GET /api/chat/stream — SSE endpoint ─────────────────────────────────────
// Supports Bearer header OR ?token= query param (EventSource can't set headers)
router.get('/stream', async (req: Request, res: Response): Promise<void> => {
  let token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : qs(req.query.token as string | string[] | undefined);

  if (!token) { res.status(401).json({ error: 'No token' }); return; }

  const profile = await validateSession(token);
  if (!profile) { res.status(401).json({ error: 'Invalid token' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = profile.role === 'ADMIN' ? `admin_${profile.id}` : profile.id;
  addClient(clientId, res);

  res.write('data: {"type":"connected"}\n\n');

  const ping = setInterval(() => res.write(':ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(clientId);
  });
});

// ─── POST /api/chat/send ──────────────────────────────────────────────────────
router.post('/send', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const profile = (req as any).profile;
  const { body, conversationId: adminConvId } = req.body as { body: string; conversationId?: string };

  if (!body?.trim()) { res.status(400).json({ error: 'body is required' }); return; }

  let conversation;
  let buyerId: string;

  if (profile.role === 'BUYER') {
    buyerId = profile.id;
    conversation = await prisma.conversation.findUnique({ where: { buyerId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { buyerId } });
    }
  } else {
    // ADMIN sending
    if (!adminConvId) { res.status(400).json({ error: 'conversationId required for admin' }); return; }
    conversation = await prisma.conversation.findUnique({ where: { id: adminConvId } });
    if (!conversation) { res.status(404).json({ error: 'Conversation not found' }); return; }
    buyerId = conversation.buyerId;
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: profile.id,
      senderRole: profile.role,
      body: body.trim(),
    },
    include: { sender: { select: { id: true, role: true, storeName: true, ownerName: true } } },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      ...(profile.role === 'BUYER'
        ? { unreadByAdmin: { increment: 1 } }
        : { unreadByBuyer: { increment: 1 } }),
    },
  });

  const payload = { conversationId: conversation.id, message };

  if (profile.role === 'BUYER') {
    sendToAllAdmins('message', payload);
    if (!hasAdminConnected()) {
      const admin = await prisma.profile.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        void sendNotification(
          admin.phone,
          `New message from ${profile.storeName ?? profile.ownerName ?? 'Buyer'}`,
        );
      }
    }
  } else {
    sendToClient(buyerId, 'message', payload);
    if (!hasBuyerConnected(buyerId)) {
      const buyer = await prisma.profile.findUnique({ where: { id: buyerId } });
      if (buyer) {
        void sendNotification(buyer.phone, 'New message from DISTRO Support');
      }
    }
  }

  res.json({ message });
});

// ─── GET /api/chat/history ────────────────────────────────────────────────────
router.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const profile = (req as any).profile;
  const convId   = qs(req.query.conversationId as string | string[] | undefined);
  const page     = Math.max(1, parseInt(qs(req.query.page as string | string[] | undefined) ?? '1') || 1);
  const limit    = Math.min(100, Math.max(1, parseInt(qs(req.query.limit as string | string[] | undefined) ?? '30') || 30));
  const skip     = (page - 1) * limit;

  let conversation;

  if (profile.role === 'BUYER') {
    conversation = await prisma.conversation.findUnique({ where: { buyerId: profile.id } });
  } else {
    if (!convId) { res.status(400).json({ error: 'conversationId required' }); return; }
    conversation = await prisma.conversation.findUnique({ where: { id: convId } });
  }

  if (!conversation) {
    res.json({ conversation: null, messages: [], total: 0 });
    return;
  }

  // Page 1 must be the NEWEST messages, not the oldest. Fetching `asc` and taking
  // the first N pinned every client to the start of the conversation: past `limit`
  // messages a buyer never saw a support reply again, and the chat screen's 5s
  // poll overwrote just-sent messages with that stale head. Page descending, then
  // reverse so callers still receive the page in chronological order.
  const [newestFirst, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { sender: { select: { id: true, role: true, storeName: true, ownerName: true } } },
    }),
    prisma.message.count({ where: { conversationId: conversation.id } }),
  ]);
  const messages = newestFirst.reverse();

  res.json({ conversation, messages, total });
});

// ─── PATCH /api/chat/read ─────────────────────────────────────────────────────
router.patch('/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const profile = (req as any).profile;
  const { conversationId } = req.body as { conversationId: string };

  if (!conversationId) { res.status(400).json({ error: 'conversationId required' }); return; }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) { res.status(404).json({ error: 'Not found' }); return; }

  const isOwner = profile.role === 'BUYER' && conversation.buyerId === profile.id;
  const isAdminRole = profile.role === 'ADMIN';
  if (!isOwner && !isAdminRole) { res.status(403).json({ error: 'Forbidden' }); return; }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: profile.role === 'BUYER' ? { unreadByBuyer: 0 } : { unreadByAdmin: 0 },
  });

  await prisma.message.updateMany({
    where: { conversationId, readAt: null },
    data: { readAt: new Date() },
  });

  res.json({ ok: true });
});

// ─── GET /api/chat/conversations — admin only ─────────────────────────────────
router.get('/conversations', requireAuth, isAdmin, async (req: Request, res: Response): Promise<void> => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    include: {
      buyer: {
        select: { id: true, storeName: true, ownerName: true, phone: true, district: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true, senderRole: true },
      },
    },
  });

  res.json({ conversations });
});

export default router;
