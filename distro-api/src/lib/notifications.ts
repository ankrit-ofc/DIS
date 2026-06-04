import axios from 'axios';
import { prisma } from './prisma';
import { sendSMS, type SmsResult } from './sms';

/**
 * Try WhatsApp first; fall back to Sparrow SMS on any failure.
 * Never throws — returns { ok, error? } so callers can safely fire-and-forget
 * with `void sendNotification(...)`.
 */
export async function sendNotification(phone: string, message: string): Promise<SmsResult> {
  if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) {
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: `977${phone}`,
          type: 'text',
          text: { body: message },
        },
        {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
          timeout: 10_000,
        },
      );
      return { ok: true };
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: unknown } })?.response?.data ??
        (err instanceof Error ? err.message : String(err));
      console.warn('[WhatsApp] failed, falling back to SMS:', detail);
    }
  }

  // Fallback (or primary if WhatsApp not configured)
  return sendSMS(phone, message);
}

export const orderConfirmMessage = (orderNumber: string, total: number): string =>
  `DISTRO: Your order ${orderNumber} (Rs ${total}) has been confirmed. We will notify you when dispatched.`;

export const statusUpdateMessage = (orderNumber: string, status: string): string =>
  `DISTRO: Your order ${orderNumber} status has been updated to ${status}.`;

// ─── Expo push notifications ─────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  channelId?: string;
  data?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Expo accepts at most 100 messages per /send request.
const EXPO_PUSH_CHUNK = 100;

/**
 * Send Expo push messages to one or many devices. Best-effort — never throws,
 * so callers can fire-and-forget with `void sendExpoPush(...)`. Chunks to
 * Expo's 100-per-request limit and prunes tokens reported DeviceNotRegistered.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  for (let i = 0; i < messages.length; i += EXPO_PUSH_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_PUSH_CHUNK);
    try {
      const res = await axios.post('https://exp.host/--/api/v2/push/send', chunk, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 10_000,
      });
      // Tickets come back in the same order as the messages sent.
      const tickets = (res.data?.data ?? []) as ExpoPushTicket[];
      await pruneDeadTokens(chunk, tickets);
      // OPTIONAL TODO: collect ok-ticket receipt ids (ticket.id) and add a
      // checkPushReceipts() for the cleanup cron to query /getReceipts and prune
      // tokens whose receipts return DeviceNotRegistered. Not wired — would need
      // persistent storage of receipt ids (see report).
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: unknown } })?.response?.data ??
        (err instanceof Error ? err.message : String(err));
      console.warn('[ExpoPush] send failed:', detail);
    }
  }
}

/** Delete PushToken rows for any ticket reporting an unregistered device. */
async function pruneDeadTokens(chunk: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<void> {
  const dead: string[] = [];
  tickets.forEach((ticket, idx) => {
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const msg = chunk[idx];
      if (msg) dead.push(msg.to);
    }
  });
  if (dead.length === 0) return;
  try {
    const { count } = await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    if (count > 0) console.warn(`[ExpoPush] pruned ${count} unregistered token(s)`);
  } catch (e) {
    console.warn('[ExpoPush] token prune failed:', e instanceof Error ? e.message : String(e));
  }
}

/** Friendly push copy for an order-status change. */
export function orderStatusPush(orderNumber: string, status: string): { title: string; body: string } {
  switch (status) {
    case 'CONFIRMED':
      return { title: 'Order confirmed 🎉', body: `Your order ${orderNumber} has been confirmed.` };
    case 'PROCESSING':
      return { title: 'Order being prepared', body: `We're preparing your order ${orderNumber}.` };
    case 'DISPATCHED':
      return { title: 'Out for delivery 🚚', body: `Your order ${orderNumber} is on the way.` };
    case 'DELIVERED':
      return { title: 'Delivered ✅', body: `Your order ${orderNumber} has been delivered.` };
    case 'CANCELLED':
      return { title: 'Order cancelled', body: `Your order ${orderNumber} was cancelled.` };
    default:
      return { title: 'Order update', body: `Your order ${orderNumber} is now ${status.toLowerCase()}.` };
  }
}
