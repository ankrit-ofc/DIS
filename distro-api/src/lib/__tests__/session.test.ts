import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { createSession, validateSession } from '../auth';

/**
 * Guards two session-token bugs that between them could 500 a login and, worse,
 * silently invalidate a session that had just been issued.
 *
 * 1. `Session.token` holds a signed JWT but was VARCHAR(191) — Prisma's default
 *    for String — while a DISTRO token was already ~190 characters. MySQL is
 *    non-strict here, so an over-long token was TRUNCATED on insert instead of
 *    erroring: login handed the client a full token, the row kept a clipped
 *    copy, and `validateSession`'s `findUnique({ where: { token } })` then
 *    missed on every subsequent request. The user saw "Invalid or expired
 *    token" immediately after signing in successfully. Widened to VARCHAR(512).
 *
 * 2. The JWT payload was only `{ profileId, iat }`, and `iat` has SECOND
 *    resolution — so two sessions for the same profile inside one second were
 *    byte-identical and the second died on `Session_token_key` as a 500.
 *    Reachable by double-tapping "Sign in". Fixed with a random `jti` claim.
 *
 * These run against a real MySQL rather than a mock on purpose: both bugs live
 * in the column definition and the uniqueness constraint, neither of which a
 * mocked client would exercise honestly — a mock would have "passed" throughout.
 *
 * Fixture rows use the `97655992XX` phone range and are dropped around every
 * test; this refuses to run against a non-local database.
 */

const PHONE_PREFIX = '97655992';

function guardDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Refusing to run destructive tests against non-local DATABASE_URL: ${url}`);
  }
}

async function wipe(): Promise<void> {
  const victims = await prisma.profile.findMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
    select: { id: true },
  });
  const ids = victims.map((v) => v.id);
  if (ids.length === 0) return;
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

describe('createSession', () => {
  it('stores the token whole, and issues a distinct one per session', async () => {
    const profile = await prisma.profile.create({
      data: { phone: `${PHONE_PREFIX}01`, passwordHash: 'x', status: 'ACTIVE' },
    });

    // Concurrent on purpose: this is the double-tapped "Sign in" that used to
    // collide, and it pins both sessions to the same `iat` second.
    const [a, b] = await Promise.all([
      createSession(profile.id),
      createSession(profile.id),
    ]);

    expect(a).not.toBe(b);

    for (const token of [a, b]) {
      const row = await prisma.session.findUnique({ where: { token } });
      expect(row).not.toBeNull();
      // The truncation bug: the row must hold the token byte for byte, or the
      // lookup above is the last one that will ever succeed.
      expect(row!.token).toBe(token);
      expect(row!.token.length).toBe(token.length);
      expect(await validateSession(token)).not.toBeNull();
    }
  });

  it('keeps a token that exceeds the old 191-char column intact', async () => {
    // Explicit regression on the column width. A DISTRO JWT with the `jti`
    // claim runs past 191 characters, which is precisely what used to be
    // silently clipped.
    const profile = await prisma.profile.create({
      data: { phone: `${PHONE_PREFIX}02`, passwordHash: 'x', status: 'ACTIVE' },
    });

    const token = await createSession(profile.id);
    expect(token.length).toBeGreaterThan(191);

    const row = await prisma.session.findUniqueOrThrow({ where: { token } });
    expect(row.token.length).toBe(token.length);
    expect(await validateSession(token)).not.toBeNull();
  });
});
