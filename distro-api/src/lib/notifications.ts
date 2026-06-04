import axios from 'axios';
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

/**
 * Send one or more Expo push messages. Best-effort — never throws, so callers
 * can fire-and-forget with `void sendExpoPush(...)`.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 10_000,
    });
  } catch (err: unknown) {
    const detail =
      (err as { response?: { data?: unknown } })?.response?.data ??
      (err instanceof Error ? err.message : String(err));
    console.warn('[ExpoPush] send failed:', detail);
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
