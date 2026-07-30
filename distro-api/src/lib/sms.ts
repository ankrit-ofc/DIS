import axios from 'axios';
// v7+ (named export, native http.Agent base). v5 was built on agent-base@6,
// whose freeSocket() destroys the socket outright, so keepAlive was impossible
// there — the upgrade is what actually makes connection reuse work.
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface SmsResult {
  ok: boolean;
  error?: string;
}

/**
 * Sparrow business codes that mean the configuration itself is broken: every
 * send will fail identically until a human changes an env var or an account
 * setting. They are NOT retryable, and the email fallback silently papering
 * over them is how a dead SMS channel masqueraded as a working feature for
 * weeks. Anything not listed here (timeouts, network errors, 1607 no credits,
 * 1011 bad number) is transient or per-recipient — fallback is the right
 * response and a plain error log is enough.
 */
const TERMINAL_CODES: Record<number, string> = {
  1001: 'caller IP is not whitelisted by Sparrow (check SMS_PROXY_URL and the whitelist)',
  1002: 'SPARROW_SMS_TOKEN is invalid or expired',
  1007: 'SPARROW_SMS_TOKEN is invalid or expired',
  1008: 'SPARROW_SMS_FROM is not an approved sender ID for this account',
};

/**
 * Single logging chokepoint for send failures. Terminal misconfigurations get
 * a distinct, greppable marker naming the broken setting; everything else logs
 * as an ordinary failure. Never receives or logs the message body (OTP).
 */
function logSendFailure(phone: string, detail: string, code: number | undefined, proxyUsed: boolean): void {
  const reason = code !== undefined ? TERMINAL_CODES[code] : undefined;
  if (reason) {
    console.error(
      `[SMS][CONFIG-ERROR] code=${code} ${reason} — SMS is broken for ALL users until this is fixed; ` +
      `OTPs are falling back to email. phone=${phone} proxy=${proxyUsed ? 'yes' : 'no'}`,
    );
    return;
  }
  console.error(`[SMS] Failed for ${phone}: ${detail} proxy=${proxyUsed ? 'yes' : 'no'}`);
}

// Optional egress proxy for Sparrow calls only (their API is IP-whitelisted;
// the proxy gives us a static IP). Contains credentials — never log it.
let proxyAgent: HttpsProxyAgent<string> | undefined;
let warnedNoProxy = false;
function getProxyAgent(): HttpsProxyAgent<string> | undefined {
  const url = process.env.SMS_PROXY_URL;
  if (!url) {
    // Sparrow IP-whitelists callers, so an unset/empty SMS_PROXY_URL in
    // production means every send leaves from the platform's rotating egress
    // IP and comes back 1001 (bad IP) — which looks identical to "SMS is
    // broken" downstream. Say so once, loudly, rather than failing silently.
    if (process.env.NODE_ENV === 'production' && !warnedNoProxy) {
      warnedNoProxy = true;
      console.error(
        '[SMS] SMS_PROXY_URL is not set in production — Sparrow calls will egress ' +
        'from an unwhitelisted IP and are expected to fail with response_code=1001',
      );
    }
    return undefined;
  }
  // keepAlive reuses the tunnel across sends. Without it every OTP pays a fresh
  // TCP connect + proxy CONNECT + TLS handshake (~600ms measured), which is the
  // dominant latency in the OTP path. maxSockets caps concurrent tunnels so a
  // burst can't exhaust the VPS's tinyproxy client slots.
  if (!proxyAgent) proxyAgent = new HttpsProxyAgent(url, { keepAlive: true, maxSockets: 20 });
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
      logSendFailure(phone, err, Number(data?.response_code), !!agent);
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : String(err);
    // Sparrow returns business failures as a non-2xx with the real code in the
    // body (1008 invalid sender arrives as HTTP 400, 1001/1002 as 403), so the
    // body is the only place the actionable code lives — surface it and use it
    // to classify.
    let code: number | undefined;
    if (axios.isAxiosError(err) && err.response?.data) {
      const body = err.response.data as { response_code?: unknown };
      if (body?.response_code !== undefined) code = Number(body.response_code);
      message += ` ${JSON.stringify(err.response.data)}`;
    }
    // Never let the proxy URL (contains credentials) reach logs or callers.
    const proxyUrl = process.env.SMS_PROXY_URL;
    if (proxyUrl) message = message.split(proxyUrl).join('[SMS_PROXY_URL]');
    // proxy= tells us whether the request even attempted the whitelisted
    // egress; without it a 1001 and a dead VPS are indistinguishable in logs.
    logSendFailure(phone, message, code, !!proxyUrl);
    return { ok: false, error: message };
  }
}

export const otpMessage = (otp: string) =>
  `Your DISTRO verification code is ${otp}. Valid for 10 minutes. Do not share.`;
