import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

// NOTE: every limiter here uses express-rate-limit's default MemoryStore, which
// is per-process. That is correct only while the API runs as a SINGLE instance:
// with N replicas each keeps its own counters, so the effective limit becomes
// N× the configured max, and a redeploy resets all counters. If we ever scale
// out horizontally, these must move to a shared store (Redis) or the numbers
// below stop meaning what they say.

// Many Nepali users sit behind shared carrier/CGNAT IPs, so per-IP limits on
// auth endpoints let one user's attempts lock out unrelated users. Key auth
// limiters by the target identifier (email/phone) instead, with a generous
// pure-IP backstop on top.
const identifierKey = (req: Request): string =>
  (req.body?.email || req.body?.phone || '').toLowerCase().trim() ||
  ipKeyGenerator(req.ip ?? '');

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: identifierKey,
  message: { error: 'Too many attempts, try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: identifierKey,
  message: { error: 'Too many OTP requests, wait 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: identifierKey,
  message: { error: 'Too many reset requests, try again in an hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Pure-IP backstop for auth endpoints. The identifier-keyed limiters above are
// the primary defence; this one exists only to stop a single host enumerating
// MANY identifiers, so it can afford to be loose.
//
// It must be loose: Nepali carriers (Ncell/NTC) put thousands of subscribers
// behind one CGNAT IP, and this backstop is shared across request-otp,
// verify-otp and login — a clean OTP login costs ~2 requests and a fumbled one
// ~4. At the old max of 60 that was only ~20 logins per shared IP per window,
// which a busy morning would exhaust and lock out blameless users. 300 gives a
// CGNAT pool ~100-150 logins per window while still stopping enumeration cold
// (a scripted attacker wants thousands, not hundreds).
export const authIpBackstopLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many attempts from this network, try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many webhook requests' },
});
