import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function createSession(profileId: string): Promise<string> {
  // `jti` makes each token unique. Without it the payload is just
  // {profileId, iat} and `iat` has SECOND resolution, so two sessions for the
  // same profile within the same second are byte-identical and the second one
  // dies on `Session_token_key` as a 500. Reachable by double-tapping "Sign in",
  // and now by the normal claim flow: verify-otp signs a rep-created shop in,
  // then /register immediately opens a second session for the same profile.
  const token = jwt.sign(
    { profileId, jti: crypto.randomUUID() },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' },
  );
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { profileId, token, expiresAt } });
  return token;
}

export async function validateSession(token: string) {
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return null;
  }
  const session = await prisma.session.findUnique({
    where: { token },
    include: { profile: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.profile;
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}
