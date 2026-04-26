import { Router, Request, Response } from 'express';
import axios from 'axios';
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
import { requireAuth } from '../middleware/auth';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter';

const router = Router();

// ─── POST /api/auth/request-otp ──────────────────────────────────────────────
// Accepts { email } OR { phone }. Email → Resend. Phone → Sparrow (stubbed).
router.post('/request-otp', otpLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, phone } = req.body as { email?: string; phone?: string };

  if (!email && !phone) {
    res.status(400).json({ error: 'email or phone is required' });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Valid email address required' });
    return;
  }
  if (phone && !/^9[6-8]\d{8}$/.test(phone)) {
    res.status(400).json({ error: 'Valid Nepal phone number required (98XXXXXXXX)' });
    return;
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  if (email) {
    let profile = await prisma.profile.findUnique({ where: { email } });
    if (!profile) {
      const tempPhone = `PENDING_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      profile = await prisma.profile.create({
        data: { email, phone: tempPhone, passwordHash: '', otpCode: otp, otpExpiry, status: 'PENDING' },
      });
    } else {
      await prisma.profile.update({ where: { email }, data: { otpCode: otp, otpExpiry } });
    }

    void (async () => {
      try {
        const html = await render(OtpEmail({ otp, email }));
        await sendEmail(email, 'Your DISTRO verification code', html, 'otp');
      } catch (e) {
        console.error('[EMAIL] OTP pipeline failed:', e);
      }
    })();

    res.json({ message: 'OTP sent', method: 'email' });
    return;
  }

  // phone branch
  let profile = await prisma.profile.findUnique({ where: { phone: phone! } });
  if (!profile) {
    profile = await prisma.profile.create({
      data: { phone: phone!, passwordHash: '', otpCode: otp, otpExpiry, status: 'PENDING' },
    });
  } else {
    await prisma.profile.update({ where: { phone: phone! }, data: { otpCode: otp, otpExpiry } });
  }

  const smsResult = await sendSMS(phone!, otpMessage(otp));
  if (!smsResult.ok && process.env.SMS_ENABLED !== 'false') {
    res.status(502).json({ error: 'Could not send OTP. Please try again.' });
    return;
  }

  res.json({ message: 'OTP sent', method: 'phone' });
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
// Accepts { email, otp } OR { phone, otp }.
router.post('/verify-otp', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, phone, otp } = req.body as { email?: string; phone?: string; otp?: string };
  if ((!email && !phone) || !otp) {
    res.status(400).json({ error: 'email or phone, and otp are required' });
    return;
  }

  const profile = email
    ? await prisma.profile.findUnique({ where: { email } })
    : await prisma.profile.findUnique({ where: { phone: phone! } });

  if (!profile || !profile.otpCode || !profile.otpExpiry) {
    res.status(400).json({ error: 'No OTP requested' });
    return;
  }
  if (profile.otpExpiry < new Date()) {
    res.status(400).json({ error: 'OTP has expired' });
    return;
  }
  if (profile.otpCode !== otp) {
    res.status(400).json({ error: 'Invalid OTP' });
    return;
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: email
      ? { emailVerified: true, phoneVerified: true, otpCode: null, otpExpiry: null, loginAttempts: 0, lockedUntil: null }
      : { phoneVerified: true, otpCode: null, otpExpiry: null, loginAttempts: 0, lockedUntil: null },
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
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
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
      panNumber: panNumber ?? null,
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
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
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

  let payload: { email?: string; name?: string; sub?: string; email_verified?: string | boolean };
  try {
    const { data } = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    payload = data;
  } catch (e) {
    res.status(401).json({ error: 'Invalid Google token' });
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
  const { storeName, ownerName, district, address, companyName, panNumber } = req.body as {
    storeName?: string;
    ownerName?: string;
    district?: string;
    address?: string;
    companyName?: string;
    panNumber?: string;
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

  const data: Record<string, any> = {};
  if (storeName   !== undefined) data.storeName   = storeName;
  if (ownerName   !== undefined) data.ownerName   = ownerName;
  if (district    !== undefined) data.district    = district;
  if (address     !== undefined) data.address     = address;
  if (companyName !== undefined) data.companyName = companyName || null;
  if (panNumber   !== undefined) data.panNumber   = panNumber   || null;

  const updated = await prisma.profile.update({ where: { id: authProfile.id }, data });
  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = updated;
  res.json(safeProfile);
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
  await prisma.profile.update({ where: { id: authProfile.id }, data: { passwordHash } });
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
      panNumber: panNumber ?? null,
      district,
      address: address ?? null,
      phoneVerified: true,
      status: existing?.status === 'PENDING' ? 'ACTIVE' : existing?.status ?? 'ACTIVE',
    },
  });

  const { passwordHash, otpCode, otpExpiry, ...safeProfile } = updated;
  res.json({ profile: safeProfile });
});

export default router;
