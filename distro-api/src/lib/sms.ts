import axios from 'axios';
import createHttpsProxyAgent from 'https-proxy-agent';

export interface SmsResult {
  ok: boolean;
  error?: string;
}

// Optional egress proxy for Sparrow calls only (their API is IP-whitelisted;
// the proxy gives us a static IP). Contains credentials — never log it.
let proxyAgent: ReturnType<typeof createHttpsProxyAgent> | undefined;
function getProxyAgent(): ReturnType<typeof createHttpsProxyAgent> | undefined {
  const url = process.env.SMS_PROXY_URL;
  if (!url) return undefined;
  if (!proxyAgent) proxyAgent = createHttpsProxyAgent(url);
  return proxyAgent;
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
  // In production the disabled/dry-run paths must fail closed and never log
  // message bodies (they can contain OTP codes).
  const isProd = process.env.NODE_ENV === 'production';
  // Dry-run overrides SMS_ENABLED (documented in .env.example).
  if (process.env.SMS_DRY_RUN === '1') {
    if (isProd) {
      console.error(`[SMS] SMS_DRY_RUN=1 in production — send to ${phone} skipped`);
      return { ok: false, error: 'SMS dry-run not allowed in production' };
    }
    console.log(`[SMS DRY-RUN] To: ${phone} | Message: ${message}`);
    return { ok: true };
  }
  if (process.env.SMS_ENABLED === 'false') {
    if (isProd) {
      console.error(`[SMS] SMS_ENABLED=false in production — send to ${phone} skipped`);
    } else {
      console.log(`[SMS] Disabled — would send to ${phone}: ${message.substring(0, 50)}...`);
    }
    return { ok: false, error: 'SMS disabled' };
  }
  if (!process.env.SPARROW_SMS_TOKEN || !process.env.SPARROW_SMS_FROM) {
    console.error(`[SMS] Failed for ${phone}: Sparrow SMS credentials not configured`);
    return { ok: false, error: 'Sparrow SMS credentials not configured' };
  }

  try {
    const to = normalize(phone);
    const agent = getProxyAgent();
    const { data } = await axios.post(
      'https://api.sparrowsms.com/v2/sms/',
      {
        token: process.env.SPARROW_SMS_TOKEN,
        from:  process.env.SPARROW_SMS_FROM,
        to,
        text:  message,
      },
      {
        timeout: 10_000,
        // proxy:false disables axios' env-based proxy handling; the agent
        // tunnels HTTPS through SMS_PROXY_URL when configured.
        ...(agent ? { httpsAgent: agent, proxy: false as const } : {}),
      },
    );

    // Sparrow returns HTTP 200 even on business-logic failures — check response_code.
    if (data?.response_code !== 200) {
      const err = `Sparrow rejected SMS: code=${data?.response_code} msg=${data?.response}`;
      console.error(`[SMS] Failed for ${phone}: ${err}`);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : String(err);
    // Sparrow returns business failures (1001 bad IP, 1002/1007 bad token,
    // 1607 no credits, 1011 bad number) as HTTP 403 — surface the body.
    if (axios.isAxiosError(err) && err.response?.data) {
      message += ` ${JSON.stringify(err.response.data)}`;
    }
    // Never let the proxy URL (contains credentials) reach logs or callers.
    const proxyUrl = process.env.SMS_PROXY_URL;
    if (proxyUrl) message = message.split(proxyUrl).join('[SMS_PROXY_URL]');
    console.error(`[SMS] Failed for ${phone}: ${message}`);
    return { ok: false, error: message };
  }
}

export const otpMessage = (otp: string) =>
  `Your DISTRO verification code is ${otp}. Valid for 10 minutes. Do not share.`;
