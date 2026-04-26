import axios from 'axios';

export interface SmsResult {
  ok: boolean;
  error?: string;
}

/** Sparrow v2 expects 10-digit Nepal mobile (9XXXXXXXXX). Strip +977 / 977 prefix if present. */
function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('977') && digits.length === 13) return digits.slice(3);
  return digits;
}

/**
 * Send an SMS via Sparrow. Never throws — returns { ok, error? }.
 * Respects SMS_ENABLED=false (skip without calling Sparrow) and the legacy
 * SMS_DRY_RUN=1 escape hatch.
 */
export async function sendSMS(phone: string, message: string): Promise<SmsResult> {
  if (process.env.SMS_ENABLED === 'false') {
    console.log(`[SMS] Disabled — would send to ${phone}: ${message.substring(0, 50)}...`);
    return { ok: false, error: 'SMS disabled' };
  }
  if (process.env.SMS_DRY_RUN === '1') {
    console.log(`[SMS DRY-RUN] To: ${phone} | Message: ${message}`);
    return { ok: true };
  }
  if (!process.env.SPARROW_SMS_TOKEN || !process.env.SPARROW_SMS_FROM) {
    console.error(`[SMS] Failed for ${phone}: Sparrow SMS credentials not configured`);
    return { ok: false, error: 'Sparrow SMS credentials not configured' };
  }

  try {
    const to = normalize(phone);
    const { data } = await axios.post(
      'https://apisms.sparrowsms.com/v2/sms/',
      {
        token: process.env.SPARROW_SMS_TOKEN,
        from:  process.env.SPARROW_SMS_FROM,
        to,
        text:  message,
      },
      { timeout: 10_000 },
    );

    // Sparrow returns HTTP 200 even on business-logic failures — check response_code.
    if (data?.response_code !== 200) {
      const err = `Sparrow rejected SMS: code=${data?.response_code} msg=${data?.response}`;
      console.error(`[SMS] Failed for ${phone}: ${err}`);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SMS] Failed for ${phone}: ${message}`);
    return { ok: false, error: message };
  }
}

export const otpMessage = (otp: string) =>
  `Your DISTRO verification code is ${otp}. Valid for 10 minutes. Do not share.`;
