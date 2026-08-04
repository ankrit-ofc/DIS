import axios from 'axios';
import { prisma } from './prisma';
import { sendSMS, type SmsResult } from './sms';
import {
  NOTIFICATION_CHANNELS,
  type NotificationEvent,
} from './notificationPolicy';

/**
 * Route a notification according to notificationPolicy.ts.
 *
 * Every non-OTP notification in the app goes through here, so the channel
 * decision lives in one map instead of being implied by which helper a route
 * happened to call. Callers name the EVENT, not the channel.
 *
 * Never throws — safe to fire-and-forget with `void dispatchNotification(...)`.
 *
 * `email` is intentionally a no-op here: the buyer-facing email templates are
 * rendered inline at each call site (they need order lines, totals, VAT), and
 * duplicating that here would mean passing half the order through. The routes
 * already send those emails; this just stops the SMS that used to accompany
 * them. Flipping an entry in the policy map back to 'sms' re-enables it here
 * with no route changes.
 */
export async function dispatchNotification(
  event: NotificationEvent,
  opts: { phone?: string; profileId?: string; message: string; title?: string },
): Promise<SmsResult> {
  const channel = NOTIFICATION_CHANNELS[event];

  if (channel === 'sms') {
    if (!opts.phone) return { ok: false, error: 'no phone for sms event' };
    return sendNotification(opts.phone, opts.message);
  }

  if (channel === 'push') {
    if (!opts.profileId) return { ok: false, error: 'no profileId for push event' };
    const tokens = await prisma.pushToken.findMany({
      where: { profileId: opts.profileId },
      select: { token: true },
    });
    if (tokens.length === 0) return { ok: true };
    await sendExpoPush(
      tokens.map((t) => ({
        to: t.token,
        title: opts.title ?? 'DISTRO',
        body: opts.message,
      })),
    );
    return { ok: true };
  }

  // 'email' — sent by the caller; 'none' — deliberately silent.
  return { ok: true };
}

/**
 * Try WhatsApp first; fall back to Sparrow SMS on any failure.
 * Never throws — returns { ok, error? } so callers can safely fire-and-forget.
 *
 * NOT for new call sites: go through `dispatchNotification` so the channel
 * stays governed by notificationPolicy.ts. This remains exported only because
 * the OTP path in routes/auth.ts calls sendSMS directly for its own cap and
 * fallback handling.
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
