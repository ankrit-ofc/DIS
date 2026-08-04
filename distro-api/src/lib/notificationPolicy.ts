/**
 * THE single place that decides which channel each notification uses.
 *
 * Before this existed the choice was implicit: seven `sendNotification(...)`
 * calls scattered across routes/orders.ts and routes/chat.ts, every one of
 * them an SMS, with no way to see the total at a glance. A full order
 * lifecycle cost about five SMS (~4.75 NPR) and chat was uncapped.
 *
 * Target state, agreed 2026-08-04: **SMS is for OTP and nothing else.**
 *
 * Read this map to answer "what do we still pay Sparrow for?" — the answer is
 * whatever says 'sms' below, and nothing else can send one, because sendSMS is
 * only reachable through the OTP path and `dispatchNotification`.
 */

export type NotificationEvent =
  | 'otp'
  | 'order_confirmation'
  | 'order_status'
  | 'order_cancelled'
  | 'chat_message_to_buyer'
  | 'chat_message_to_admin';

/**
 * - `sms`   — costs ~0.95 NPR a message. OTP only.
 * - `email` — free via Resend, but ONLY reaches buyers who have an address.
 *             Rep-created shops (POST /sales/buyers collects no email) and
 *             phone-first signups that skipped it receive NOTHING for these
 *             events. That is a known and accepted consequence of the
 *             OTP-only decision, not an oversight — see docs/known-issues.md.
 * - `push`  — free Expo push to the buyer's registered devices.
 * - `none`  — deliberately not notified.
 */
export type NotificationChannel = 'sms' | 'email' | 'push' | 'none';

export const NOTIFICATION_CHANNELS: Record<NotificationEvent, NotificationChannel> = {
  // The one remaining SMS. It is the authentication channel: a shopkeeper with
  // no email has no other way in, so this can never move.
  otp: 'sms',

  // Order lifecycle → email. The buyer-facing email templates already exist and
  // are already sent alongside the old SMS, so removing the SMS leaves the
  // email path untouched rather than needing new templates.
  order_confirmation: 'email',
  order_status: 'email',
  order_cancelled: 'email',

  // Chat is realtime; email is the wrong medium for it. `sendExpoPush` and the
  // PushToken table were already built and had zero callers — this is the first.
  chat_message_to_buyer: 'push',

  // Admins work at a dashboard with a live socket; an SMS per buyer message was
  // uncapped spend for something already on screen.
  chat_message_to_admin: 'none',
};

/** True only for events this policy still routes to Sparrow. */
export function usesSms(event: NotificationEvent): boolean {
  return NOTIFICATION_CHANNELS[event] === 'sms';
}
