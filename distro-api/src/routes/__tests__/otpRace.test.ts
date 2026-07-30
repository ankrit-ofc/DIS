import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma';
import { findOrCreateProfile } from '../auth';

/**
 * Guards the concurrency bug where two simultaneous /request-otp calls for the
 * same not-yet-registered phone both passed the findUnique check, both tried to
 * INSERT, and the loser died on `Profile_phone_key` with an unhandled P2002 —
 * surfacing to the caller as HTTP 500.
 *
 * It is a first-run bug with a mundane trigger: double-tapping "Send code"
 * while waiting for a slow SMS. Against the pre-fix code this file fails with
 * P2002 (measured: 2 failures per 3 parallel requests); it passes only when the
 * conflict is caught and the winner's row re-read.
 *
 * Runs against the local MySQL from DATABASE_URL. All fixture rows use the
 * `97655990XX` phone range and the `@otprace.test` email domain and are dropped
 * around every test, so this never touches real data; it refuses to run against
 * a non-local database.
 */

const PHONE_PREFIX = '97655990';
const EMAIL_DOMAIN = '@otprace.test';

function guardDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Refusing to run destructive tests against non-local DATABASE_URL: ${url}`);
  }
}

async function wipe(): Promise<void> {
  const victims = await prisma.profile.findMany({
    where: {
      OR: [
        { phone: { startsWith: PHONE_PREFIX } },
        { email: { endsWith: EMAIL_DOMAIN } },
      ],
    },
    select: { id: true },
  });
  const ids = victims.map((v) => v.id);
  if (ids.length === 0) return;
  await prisma.otpCode.deleteMany({ where: { profileId: { in: ids } } });
  await prisma.session.deleteMany({ where: { profileId: { in: ids } } });
  await prisma.profile.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(async () => {
  guardDatabase();
  await wipe();
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('findOrCreateProfile under concurrent first-time requests', () => {
  it('converges on one profile when 3 parallel calls race for the same new phone', async () => {
    const phone = `${PHONE_PREFIX}01`;

    // Fired without awaiting between them — curl-style sequential starts are
    // too jittery to collide reliably; Promise.all is what actually reproduces it.
    const profiles = await Promise.all([
      findOrCreateProfile(undefined, phone),
      findOrCreateProfile(undefined, phone),
      findOrCreateProfile(undefined, phone),
    ]);

    expect(profiles).toHaveLength(3);
    for (const p of profiles) expect(p.phone).toBe(phone);

    // Every racer must return the SAME row, not just "a" row.
    const ids = new Set(profiles.map((p) => p.id));
    expect(ids.size).toBe(1);

    expect(await prisma.profile.count({ where: { phone } })).toBe(1);
  });

  it('survives a wider burst (10 parallel calls, same phone)', async () => {
    const phone = `${PHONE_PREFIX}02`;

    const profiles = await Promise.all(
      Array.from({ length: 10 }, () => findOrCreateProfile(undefined, phone)),
    );

    expect(new Set(profiles.map((p) => p.id)).size).toBe(1);
    expect(await prisma.profile.count({ where: { phone } })).toBe(1);
  });

  it('converges on one profile when parallel calls race for the same new email', async () => {
    const email = `racer${EMAIL_DOMAIN}`;

    const profiles = await Promise.all([
      findOrCreateProfile(email, undefined),
      findOrCreateProfile(email, undefined),
      findOrCreateProfile(email, undefined),
    ]);

    expect(new Set(profiles.map((p) => p.id)).size).toBe(1);
    expect(await prisma.profile.count({ where: { email } })).toBe(1);

    // The email branch mints a random PENDING_ placeholder phone. Exactly one
    // must survive — this is the case that makes upsert the wrong tool, since
    // its create block would generate a fresh placeholder on every retry.
    const rows = await prisma.profile.findMany({ where: { email } });
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toMatch(/^PENDING_/);
  });

  it('returns the existing profile without creating a duplicate', async () => {
    const phone = `${PHONE_PREFIX}03`;

    const first = await findOrCreateProfile(undefined, phone);
    const second = await findOrCreateProfile(undefined, phone);

    expect(second.id).toBe(first.id);
    expect(await prisma.profile.count({ where: { phone } })).toBe(1);
  });
});
