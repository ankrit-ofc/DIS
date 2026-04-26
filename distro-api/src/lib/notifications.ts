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
