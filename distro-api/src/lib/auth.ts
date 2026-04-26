import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createSession(profileId: string): Promise<string> {
  const token = jwt.sign({ profileId }, process.env.JWT_SECRET!, { expiresIn: '30d' });
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
