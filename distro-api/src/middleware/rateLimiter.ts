import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

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

// Pure-IP backstop for auth endpoints — generous enough for CGNAT, tight
// enough to stop a single host hammering many identifiers.
export const authIpBackstopLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
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
