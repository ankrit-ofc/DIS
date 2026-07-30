import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  generateOTP,
  createSession,
  deleteSession,
} from '../lib/auth';
import { sendSMS, otpMessage } from '../lib/sms';
import { sendEmail, render } from '../lib/email';
import { WelcomeEmail } from '../emails/WelcomeEmail';
import { OtpEmail } from '../emails/OtpEmail';
import { PasswordResetEmail } from '../emails/PasswordResetEmail';
import { requireAuth } from '../middleware/auth';
import { validateCoords } from '../lib/geo';
import { validateActiveDistrict } from '../lib/districts';
import {
  authLimiter,
  otpLimiter,
  forgotLimiter,
  authIpBackstopLimiter,
} from '../middleware/rateLimiter';

const router = Router();

const MAX_OTP_ATTEMPTS = 5;
const MAX_LIVE_OTP_CODES = 2;

/**
 * Per-phone daily ceiling on *billed* SMS sends (Sparrow charges 0.95 NPR each).
 * otpLimiter caps bursts at 3/min but permits ~4,320 sends/day for one number
 * (~4,100 NPR of credit), so this is the actual cost-abuse control.
 *
 * 10 is sized off a legitimately bad day, not a happy path: an SMS that never
 * arrives and gets retried to the 3/min burst limit, a second attempt later,
 * plus a few verify failures, lands around 6-9. 10 clears that with headroom
 * while capping a targeted attacker at 9.50 NPR/day instead of ~4,100 — a ~430x
 * reduction. Raise it if support sees real users hitting the cap.
 */
const MAX_SMS_PER_PHONE_PER_DAY = 10;

const NEPAL_PHONE = /^9[6-8]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maskPhone = (p: string) => `${p.slice(0, 2)}******${p.slice(-2)}`;
const maskEmail = (e: string) => {
  const [local, domain] = e.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

/**
 * Find the profile for this identifier, creating it if absent.
 *
 * Two concurrent first-time requests for the same phone both saw null and both
 * inserted; the loser hit an unhandled P2002 and the caller got an HTTP 500.
 * That is not an exotic race — it is what a first-time user gets for
 * double-tapping "Send code" while waiting for a slow SMS (reproduced at 2
 * failures per 3 parallel requests).
 *
 * Catch-and-refetch is used rather than upsert because the email-first branch
 * mints a random PENDING_ placeholder phone: an upsert's create block would
 * generate a *different* placeholder on each attempt, so the conflict target
 * and the created row disagree. Re-reading the winner's row is both simpler and
 * exactly what we want — losers of the race adopt the profile that won.
 */
// Exported for the concurrency regression test in __tests__/otpRace.test.ts.
export async function findOrCreateProfile(email?: string, phone?: string) {
  const where = email ? { email } : { phone: phone! };

  const existing = await prisma.profile.findUnique({ where });
  if (existing) return existing;

  try {
    return email
      ? await prisma.profile.create({
          data: {
            email,
            phone: `PENDING_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            passwordHash: '',
            status: 'PENDING',
          },
        })
      : await prisma.profile.create({
          data: { phone: phone!, passwordHash: '', status: 'PENDING' },
        });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await prisma.profile.findUnique({ where });
      if (winner) return winner;
    }
    throw err;
  }
}

/** Billed SMS sends for this profile in the trailing 24h (see MAX_SMS_PER_PHONE_PER_DAY). */
async function smsSentLast24h(profileId: string): Promise<number> {
  return prisma.otpCode.count({
    where: { profileId, smsSentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

/** Create a fresh OTP code for a profile, keeping at most MAX_LIVE_OTP_CODES live. */
async function issueOtpCode(profileId: string): Promise<{ otp: string; id: string }> {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const created = await prisma.otpCode.create({ data: { profileId, code: otp, expiresAt } });

  // Invalidate everything older than the newest MAX_LIVE_OTP_CODES codes.
  const live = await prisma.otpCode.findMany({
    where: { profileId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const staleIds = live.slice(MAX_LIVE_OTP_CODES).map((c) => c.id);
  if (staleIds.length > 0) {
    await prisma.otpCode.updateMany({
      where: { id: { in: staleIds } },
      data: { usedAt: new Date() },
    });
  }

  return { otp, id: created.id };
}

// ─── POST /api/auth/request-otp ──────────────────────────────────────────────
// Accepts { email } and/or { phone }, plus optional forceChannel ("sms"|"email").
// Delivery priority: SMS first whenever a phone is available (from the request
// or stored on the Profile), email (Resend) as fallback. ONE code is issued and
// is valid regardless of which channel delivered it.
router.post('/request-otp', authIpBackstopLimiter, otpLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, phone, forceChannel } = req.body as {
    email?: string;
    phone?: string;
    forceChannel?: string;
  };

  if (!email && !phone) {
    res.status(400).json({ error: 'email or phone is required' });
    return;
  }
  if (email && !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Valid email address required' });
    return;
  }
  if (phone && !NEPAL_PHONE.test(phone)) {
    res.status(400).json({ error: 'Valid Nepal phone number required (98XXXXXXXX)' });
    return;
  }
  if (forceChannel !== undefined && forceChannel !== 'sms' && forceChannel !== 'email') {
    res.status(400).json({ error: 'forceChannel must be "sms" or "email"' });
    return;
  }

  // TEMPORARY DIAGNOSTIC — remove once trust-proxy is confirmed in production.
  // `app.set('trust proxy', 1)` trusts exactly one hop; if Railway fronts the
  // API with a different number of proxies, req.ip is not the real client and
  // the pure-IP backstop silently collapses onto a single shared key.
  // Logs the IP only — no phone, email, or OTP.
  console.log(
    `[OTP][PROXY-DIAG] req.ip=${req.ip} xff="${req.headers['x-forwarded-for'] ?? ''}" ` +
    `xri="${req.headers['x-real-ip'] ?? ''}"`,
  );

  // Find or create the profile — email is the primary identifier when both are
  // sent. Real phone binding happens at /register with a uniqueness check, so an
  // email-first profile gets a placeholder phone even if one was supplied.
  const profile = await findOrCreateProfile(email, phone);

  // Deliverable addresses: request values win, stored profile values fill gaps.
  // Placeholder phones (PENDING_/DELETED_) never pass the Nepal-format check.
  const smsPhone = phone ?? (NEPAL_PHONE.test(profile.phone) ? profile.phone : undefined);
  const emailTo = email ?? profile.email ?? undefined;

  if (forceChannel === 'sms' && !smsPhone) {
    res.status(400).json({ error: 'No phone number available for SMS delivery' });
    return;
  }
  if (forceChannel === 'email' && !emailTo) {
    res.status(400).json({ error: 'No email address available for email delivery' });
    return;
  }

  const { otp, id: otpId } = await issueOtpCode(profile.id);

  const sendOtpEmail = async (): Promise<boolean> => {
    if (!emailTo) return false;
    try {
      const html = await render(OtpEmail({ otp, email: emailTo }));
      const result = await sendEmail(emailTo, 'Your DISTRO verification code', html, 'otp');
      return result.ok;
    } catch (e) {
      console.error('[OTP] email delivery failed:', e instanceof Error ? e.message : e);
      return false;
    }
  };

  // Primary channel: SMS (unless the caller forced email).
  let smsFailure: string | undefined;
  let smsCapped = false;
  if (forceChannel !== 'email' && smsPhone) {
    // Cost control: refuse to bill another send once the daily ceiling is hit.
    // This degrades to the email fallback rather than hard-failing, so a capped
    // user with an email still receives their code.
    smsCapped = (await smsSentLast24h(profile.id)) >= MAX_SMS_PER_PHONE_PER_DAY;
    if (smsCapped) {
      smsFailure = `daily SMS cap reached (${MAX_SMS_PER_PHONE_PER_DAY}/24h)`;
      console.warn(`[OTP] sms_cap_reached profileId=${profile.id} cap=${MAX_SMS_PER_PHONE_PER_DAY}`);
    } else {
      const sms = await sendSMS(smsPhone, otpMessage(otp));
      if (sms.ok) {
        // Stamp only on a send Sparrow accepted — that is what costs a credit,
        // and what the cap counts. Failed sends are free and must not count.
        await prisma.otpCode.update({ where: { id: otpId }, data: { smsSentAt: new Date() } });
        res.json({ sent: true, channel: 'sms', maskedTo: maskPhone(smsPhone), message: 'OTP sent', method: 'phone' });
        return;
      }
      smsFailure = sms.error ?? 'unknown';
    }
    if (forceChannel === 'sms') {
      console.warn(`[OTP] channel_attempted=sms channel_used=none reason="${smsFailure}"`);
      res.status(smsCapped ? 429 : 502).json({
        error: smsCapped ? 'otp_sms_daily_limit' : 'otp_delivery_failed',
      });
      return;
    }
  }

  // Fallback channel: email.
  const emailOk = await sendOtpEmail();
  if (smsFailure !== undefined) {
    // Fallback telemetry for monitoring SMS failure rates. Never log the OTP.
    console.warn(`[OTP] channel_attempted=sms channel_used=${emailOk ? 'email' : 'none'} reason="${smsFailure}"`);
  }
  if (emailOk) {
    res.json({ sent: true, channel: 'email', maskedTo: maskEmail(emailTo!), message: 'OTP sent', method: 'email' });
    return;
  }

  // A capped user with no email has nowhere left to go — say so distinctly
  // rather than reporting a delivery failure that never happened.
  res.status(smsCapped ? 429 : 502).json({
    error: smsCapped ? 'otp_sms_daily_limit' : 'otp_delivery_failed',
  });
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
// Accepts { email, otp } OR { phone, otp }.
router.post('/verify-otp', authIpBackstopLimiter, authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, phone, otp } = req.body as { email?: string; phone?: string; otp?: string };
  if ((!email && !phone) || !otp) {
    res.status(400).json({ error: 'email or phone, and otp are required' });
    return;
  }

  const profile = email
    ? await prisma.profile.findUnique({ where: { email } })
    : await prisma.profile.findUnique({ where: { phone: phone! } });

  if (!profile) {
    res.status(400).json({ error: 'No OTP requested' });
    return;
  }

  // Any unused, unexpired, not-burned-out code counts — most recent first.
  const liveCodes = await prisma.otpCode.findMany({
    where: {
      profileId: profile.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_OTP_ATTEMPTS },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (liveCodes.length === 0) {
    res.status(400).json({ error: 'No OTP requested' });
    return;
  }

  const match = liveCodes.find((c) => c.code === otp);
  if (!match) {
    // Wrong guess burns one attempt on every live code; a code dies after
    // MAX_OTP_ATTEMPTS wrong guesses (OTP verify doubles as passwordless login).
    await prisma.otpCode.updateMany({
      where: { id: { in: liveCodes.map((c) => c.id) } },
      data: { attempts: { increment: 1 } },
    });
    res.status(400).json({ error: 'Invalid OTP' });
    return;
  }

  // Consume the code atomically so a concurrent verify can't reuse it.
  const consumed = await prisma.otpCode.updateMany({
    where: { id: match.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count === 0) {
    res.status(400).json({ error: 'Invalid OTP' });
    return;
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: email
      ? { emailVerified: true, phoneVerified: true, loginAttempts: 0, lockedUntil: null }
      : { phoneVerified: true, loginAttempts: 0, lockedUntil: null },
  });

  // If this is an already-registered user, issue a session so OTP works as a login.
  if (updated.status === 'ACTIVE') {
    const token = await createSession(updated.id);
    const { passwordHash, otpCode, otpExpiry, ...safeProfile } = updated;
    res.json({ message: 'Verified', token, profile: safeProfile });
    return;
  }

  // Otherwise just confirm verification; client routes to registration.
  res.json({ message: 'Verified', requiresRegistration: true });
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Requires prior OTP verification. Email is primary identifier; phone is additional info.
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password, storeName, ownerName, district, phone, address, companyName, panNumber } =
    req.body as {
      email?: string;
      password?: string;
      storeName?: string;
      ownerName?: string;
      district?: string;
      phone?: string;
      address?: string;
      companyName?: string;
      panNumber?: string;
    };

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }
  if (panNumber && !/^\d{9}$/.test(panNumber)) {
    res.status(400).json({ error: 'PAN number must be exactly 9 digits' });
    return;
  }
  if (district) {
    const districtError = await validateActiveDistrict(district);
    if (districtError) {
      res.status(400).json({ error: districtError });
      return;
    }
  }

  const profile = await prisma.profile.findUnique({ where: { email } });
  if (!profile) {
    res.status(400).json({ error: 'Email not found — request OTP first' });
    return;
  }
  if (!profile.phoneVerified) {
    res.status(400).json({ error: 'Email not verified — complete OTP verification first' });
    return;
  }
  if (profile.status === 'ACTIVE') {
    res.status(409).json({ error: 'Account already registered' });
    return;
  }

  // Validate phone uniqueness (another profile already owns this real phone)
  const phoneTaken = await prisma.profile.findFirst({
    where: { phone, id: { not: profile.id } },
  });
  if (phoneTaken) {
    res.status(409).json({ error: 'Phone number already in use' });
    return;
  }

  // Validate PAN uniqueness if provided
  if (panNumber) {
    const panTaken = await prisma.profile.findFirst({
      where: { panNumber, id: { not: profile.id } },
    });
    if (panTaken) {
      res.status(409).json({ error: 'PAN number already in use' });
      return;
    }
  }

  const passwordHash = await hashPassword(password);

  const updated = await prisma.profile.update({
    where: { email },
    data: {
      passwordHash,
      phone,
      status: 'ACTIVE',
      storeName,
      ownerName,
      district,
      address,
      companyName: companyName ?? null,
      // `|| null`, not `?? null`: an empty-string PAN would be stored as '' and,
      // because Profile.panNumber is unique, the second such registration would
      // die on P2002 as a 500. Matches the PATCH /me path below.
      panNumber: panNumber || null,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  const token = await createSession(updated.id);

  // Non-blocking welcome email
  void (async () => {
    try {
      const html = await render(WelcomeEmail({
        storeName: updated.storeName ?? updated.phone,
        phone: updated.phone,
      }));
      await sendEmail(updated.email!, 'Welcome to DISTRO', html, 'welcome');
    } catch (e) {
      console.error('[EMAIL] Welcome pipeline failed:', e);
    }
  })();

  const { passwordHash: _, otpCode, otpExpiry, ...safeProfile } = updated;
  res.status(201).json({ token, profile: safeProfile });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Accept { email, password } — email can be email address OR phone (backwards compat).
// Finds profile where email = input OR phone = input.
router.post('/login', authIpBackstopLimiter, authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  // Support both email and phone login (backwards compat)
  const profile = await prisma.profile.findFirst({
    where: { OR: [{ email }, { phone: email }] },
  });

  if (!profile || profile.status === 'PENDING') {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (profile.status === 'SUSPENDED') {
    res.status(403).json({ error: 'Account suspended' });
    return;
  }

  // Lockout check
  if (profile.lockedUntil && profile.lockedUntil > new Date()) {
    const remaining = Math.ceil((profile.lockedUntil.getTime() - Date.now()) / 1000);
    res.status(429).json({ error: 'Account locked', lockedUntil: profile.lockedUntil, remaining });
    return;
  }

  const valid = await verifyPassword(password, profile.passwordHash);
  if (!valid) {
    const attempts = profile.loginAttempts + 1;
    const lockData =
      attempts >= 5
        ? { loginAttempts: attempts, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
        : { loginAttempts: attempts };

    await prisma.profile.update({ where: { id: profile.id }, data: lockData });

    if (attempts >= 5) {
      res.status(429).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
    } else {
      res.status(401).json({ error: 'Invalid credentials', attemptsRemaining: 5 - attempts });
    }
    return;
  }

  // Success — reset lockout counters
  await prisma.profile.update({
    where: { id: profile.id },
    data: { loginAttempts: 0, lockedUntil: null },
  });

  const token = await createSession(profile.id);
  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = profile;
  res.json({ token, profile: safeProfile });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const token = (req as any).token as string;
  await deleteSession(token);
  res.json({ message: 'Logged out' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  const profile = (req as any).profile;
  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = profile;
  res.json(safeProfile);
});

// ─── POST /api/auth/google ───────────────────────────────────────────────────
// Verify Google ID token → find/link/create profile → return session token.
router.post('/google', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  let payload: { email?: string; name?: string; sub?: string; email_verified?: string | boolean; aud?: string };
  try {
    const { data } = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    payload = data;
  } catch (e) {
    res.status(401).json({ error: 'Invalid Google token' });
    return;
  }

  // The token must have been issued for OUR app — tokeninfo happily validates
  // tokens minted for any Google client.
  const allowedAudiences = (process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_CLIENT_ID ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (!payload.aud || !allowedAudiences.includes(payload.aud)) {
    res.status(401).json({ error: 'Invalid Google token' });
    return;
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    res.status(401).json({ error: 'Google email not verified' });
    return;
  }

  const email = payload.email;
  const name = payload.name;
  const googleId = payload.sub;

  if (!email || !googleId) {
    res.status(400).json({ error: 'Google token missing email or sub' });
    return;
  }

  let profile = await prisma.profile.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });

  let requiresOnboarding = false;

  if (!profile) {
    // Create new PENDING profile
    const tempPhone = `PENDING_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    profile = await prisma.profile.create({
      data: {
        email,
        phone: tempPhone,
        passwordHash: '',
        googleId,
        ownerName: name ?? null,
        emailVerified: true,
        phoneVerified: false,
        status: 'PENDING',
      },
    });
    requiresOnboarding = true;
  } else if (!profile.googleId) {
    // Link Google to existing profile
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: { googleId, emailVerified: true },
    });
  }

  if (profile.status === 'PENDING' || profile.phone.startsWith('PENDING_')) {
    requiresOnboarding = true;
  }
  if (profile.status === 'SUSPENDED') {
    res.status(403).json({ error: 'Account suspended' });
    return;
  }

  const token = await createSession(profile.id);
  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = profile;
  res.json({ token, profile: safeProfile, requiresOnboarding });
});

// ─── PATCH /api/auth/me — update own profile ────────────────────────────────
router.patch('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authProfile = (req as any).profile as { id: string };
  const { storeName, ownerName, district, address, companyName, panNumber, latitude, longitude } = req.body as {
    storeName?: string;
    ownerName?: string;
    district?: string;
    address?: string;
    companyName?: string;
    panNumber?: string;
    latitude?: number;
    longitude?: number;
  };

  if (panNumber && !/^\d{9}$/.test(panNumber)) {
    res.status(400).json({ error: 'PAN number must be exactly 9 digits' });
    return;
  }
  if (panNumber) {
    const panTaken = await prisma.profile.findFirst({
      where: { panNumber, id: { not: authProfile.id } },
      select: { id: true },
    });
    if (panTaken) {
      res.status(409).json({ error: 'PAN number already in use' });
      return;
    }
  }

  // Grandfathering: profiles keeping their existing (possibly now-inactive)
  // district pass through untouched; only an actual CHANGE must be an active one.
  if (district !== undefined && district !== '') {
    const current = await prisma.profile.findUnique({
      where: { id: authProfile.id },
      select: { district: true },
    });
    if (district !== current?.district) {
      const districtError = await validateActiveDistrict(district);
      if (districtError) {
        res.status(400).json({ error: districtError });
        return;
      }
    }
  }

  const data: Record<string, any> = {};
  if (storeName   !== undefined) data.storeName   = storeName;
  if (ownerName   !== undefined) data.ownerName   = ownerName;
  if (district    !== undefined) data.district    = district;
  if (address     !== undefined) data.address     = address;
  if (companyName !== undefined) data.companyName = companyName || null;
  if (panNumber   !== undefined) data.panNumber   = panNumber   || null;
  if (latitude !== undefined || longitude !== undefined) {
    const coordError = validateCoords(latitude, longitude);
    if (coordError) {
      res.status(400).json({ error: coordError });
      return;
    }
    data.latitude  = latitude;
    data.longitude = longitude;
  }

  const updated = await prisma.profile.update({ where: { id: authProfile.id }, data });
  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = updated;
  res.json(safeProfile);
});

// ─── POST /api/auth/push-token — register/refresh this device's Expo token ───
router.post('/push-token', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authProfile = (req as any).profile as { id: string };
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  // Upsert by token: a device's token is unique and may move between accounts.
  await prisma.pushToken.upsert({
    where:  { token },
    create: { token, profileId: authProfile.id, platform: platform ?? null },
    update: { profileId: authProfile.id, platform: platform ?? null },
  });

  res.json({ ok: true });
});

// ─── DELETE /api/auth/me — delete own account (anonymize + deactivate) ───────
// We do NOT hard-delete: Profile is referenced by Order/Ledger/Payment rows that
// must survive for VAT/accounting. Instead we scrub PII, mark the account
// SUSPENDED, and revoke all sessions. Order/ledger history stays intact.
router.delete('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authProfile = (req as any).profile as { id: string };

  // phone is NOT NULL + @unique, so it can't be nulled — use a unique tombstone.
  const tombstonePhone = `DELETED_${authProfile.id}`;

  await prisma.$transaction([
    prisma.profile.update({
      where: { id: authProfile.id },
      data: {
        status: 'SUSPENDED',
        phone: tombstonePhone,
        email: null,
        ownerName: null,
        storeName: null,
        address: null,
        district: null,
        companyName: null,
        panNumber: null,
        googleId: null,
        passwordHash: '',          // empty hash → bcrypt.compare always fails
        emailVerified: false,
        phoneVerified: false,
        loginAttempts: 0,
        lockedUntil: null,
      },
    }),
    // Revoke every active session for this profile.
    prisma.session.deleteMany({ where: { profileId: authProfile.id } }),
    // Kill any live OTP codes — the tombstoned account must not be enterable.
    prisma.otpCode.deleteMany({ where: { profileId: authProfile.id } }),
    // Drop device push tokens — the anonymized Profile survives, so the
    // PushToken ON DELETE CASCADE never fires; remove them explicitly.
    prisma.pushToken.deleteMany({ where: { profileId: authProfile.id } }),
  ]);

  res.json({ message: 'Account deleted' });
});

// ─── POST /api/auth/change-password — change own password ───────────────────
router.post('/change-password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authProfile = (req as any).profile as { id: string };
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };

  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: 'oldPassword and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const profile = await prisma.profile.findUnique({ where: { id: authProfile.id } });
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const valid = await verifyPassword(oldPassword, profile.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  const currentToken = (req as any).token as string;
  await prisma.$transaction([
    prisma.profile.update({ where: { id: authProfile.id }, data: { passwordHash } }),
    // Revoke every other session — only the device that changed the password stays in.
    prisma.session.deleteMany({
      where: { profileId: authProfile.id, token: { not: currentToken } },
    }),
  ]);
  res.json({ message: 'Password changed' });
});

// ─── POST /api/auth/complete-onboarding ──────────────────────────────────────
// For Google users (or any PENDING user) to complete required profile fields.
router.post('/complete-onboarding', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authProfile = (req as any).profile as { id: string };
  const { phone, storeName, companyName, panNumber, district, address } = req.body as {
    phone?: string;
    storeName?: string;
    companyName?: string;
    panNumber?: string;
    district?: string;
    address?: string;
  };

  if (!phone || !storeName || !district) {
    res.status(400).json({ error: 'phone, storeName, and district are required' });
    return;
  }
  if (!/^9[6-8]\d{8}$/.test(phone)) {
    res.status(400).json({ error: 'Valid Nepal phone number required (98XXXXXXXX)' });
    return;
  }
  if (panNumber && !/^\d{9}$/.test(panNumber)) {
    res.status(400).json({ error: 'PAN number must be exactly 9 digits' });
    return;
  }
  const districtError = await validateActiveDistrict(district);
  if (districtError) {
    res.status(400).json({ error: districtError });
    return;
  }

  const phoneTaken = await prisma.profile.findFirst({
    where: { phone, id: { not: authProfile.id } },
  });
  if (phoneTaken) {
    res.status(409).json({ error: 'Phone number already in use' });
    return;
  }
  if (panNumber) {
    const panTaken = await prisma.profile.findFirst({
      where: { panNumber, id: { not: authProfile.id } },
    });
    if (panTaken) {
      res.status(409).json({ error: 'PAN number already in use' });
      return;
    }
  }

  const existing = await prisma.profile.findUnique({ where: { id: authProfile.id } });
  const updated = await prisma.profile.update({
    where: { id: authProfile.id },
    data: {
      phone,
      storeName,
      companyName: companyName ?? null,
      // See the register handler: `|| null` so '' becomes NULL instead of
      // colliding on the unique index.
      panNumber: panNumber || null,
      district,
      address: address ?? null,
      phoneVerified: true,
      status: existing?.status === 'PENDING' ? 'ACTIVE' : existing?.status ?? 'ACTIVE',
    },
  });

  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = updated;
  res.json({ profile: safeProfile });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', authIpBackstopLimiter, forgotLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  const generic = { success: true, message: 'If that email exists, we sent a code' };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.json(generic);
    return;
  }

  const profile = await prisma.profile.findUnique({ where: { email } });
  if (!profile || profile.status !== 'ACTIVE') {
    res.json(generic);
    return;
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await prisma.passwordResetCode.create({
    data: { profileId: profile.id, code, expiresAt },
  });

  void (async () => {
    try {
      const html = await render(PasswordResetEmail({ otp: code, email }));
      await sendEmail(email, 'DISTRO — Reset your password', html, 'password-reset');
    } catch (e) {
      console.error('[EMAIL] Password reset pipeline failed:', e);
    }
  })();

  res.json(generic);
});

// ─── POST /api/auth/verify-reset-code ────────────────────────────────────────
router.post('/verify-reset-code', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) {
    res.status(400).json({ error: 'email and code are required' });
    return;
  }

  const profile = await prisma.profile.findUnique({ where: { email } });
  if (!profile) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }

  const record = await prisma.passwordResetCode.findFirst({
    where: {
      profileId: profile.id,
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }

  await prisma.passwordResetCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const resetToken = jwt.sign(
    { profileId: profile.id, isPasswordResetToken: true },
    process.env.JWT_SECRET!,
    { expiresIn: '10m' },
  );

  res.json({ success: true, resetToken });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { resetToken, newPassword } = req.body as { resetToken?: string; newPassword?: string };
  if (!resetToken || !newPassword) {
    res.status(400).json({ error: 'resetToken and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  let payload: { profileId?: string; isPasswordResetToken?: boolean };
  try {
    payload = jwt.verify(resetToken, process.env.JWT_SECRET!) as any;
  } catch {
    res.status(400).json({ error: 'Invalid or expired reset token' });
    return;
  }

  if (!payload.isPasswordResetToken || !payload.profileId) {
    res.status(400).json({ error: 'Invalid reset token' });
    return;
  }

  const profile = await prisma.profile.findUnique({ where: { id: payload.profileId } });
  if (!profile) {
    res.status(400).json({ error: 'Invalid reset token' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.profile.update({
    where: { id: profile.id },
    data: { passwordHash, loginAttempts: 0, lockedUntil: null },
  });

  // Invalidate all existing sessions — force fresh sign-in
  await prisma.session.deleteMany({ where: { profileId: profile.id } });

  res.json({ success: true });
});

export default router;
