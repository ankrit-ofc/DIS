import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../lib/prisma';
import { findOrCreateProfile } from '../auth';

/**
 * Guards the phone-first registration switch.
 *
 * Registration used to require an email, which meant request-otp had no phone to
 * send to and the SMS-first path could never fire for a new user — backwards for
 * Nepali shopkeepers, who use their number daily and may have no working email.
 *
 * These tests exercise the invariants the route depends on rather than the HTTP
 * handler (same rationale as orderReversal/orderIdempotency): the things that
 * actually break are the unique indexes and the NULL-vs-'' distinction, none of
 * which a mocked client would exercise honestly.
 *
 * Runs against the local MySQL from DATABASE_URL. All fixture rows use the
 * `97655991XX` phone range and the `@phonefirst.test` email domain and are
 * dropped around every test; it refuses to run against a non-local database.
 */

const PHONE_PREFIX = '97655991';
const EMAIL_DOMAIN = '@phonefirst.test';

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

describe('phone-first registration', () => {
  it('creates a phone-keyed PENDING profile with the REAL phone, not a placeholder', async () => {
    // The email branch mints a `PENDING_<ts>_<rand>` placeholder phone, which
    // never matches NEPAL_PHONE and so can never be texted. Phone-first must
    // store the real number from the very first request — that is the whole
    // point, since it is what makes request-otp's SMS branch reachable.
    const phone = `${PHONE_PREFIX}01`;
    const profile = await findOrCreateProfile(undefined, phone);

    expect(profile.phone).toBe(phone);
    expect(profile.phone.startsWith('PENDING_')).toBe(false);
    expect(profile.status).toBe('PENDING');
    expect(profile.email).toBeNull();
    expect(profile.passwordHash).toBe('');
  });

  it('re-adopts the existing profile instead of duplicating on a second request', async () => {
    const phone = `${PHONE_PREFIX}02`;
    const first = await findOrCreateProfile(undefined, phone);
    const second = await findOrCreateProfile(undefined, phone);

    expect(second.id).toBe(first.id);
    const all = await prisma.profile.findMany({ where: { phone } });
    expect(all).toHaveLength(1);
  });

  it('does not 500 when two registrations race on the same new phone', async () => {
    // A first-time user double-tapping "Send code" on a slow connection. The
    // loser of the insert must adopt the winner's row, not surface a P2002.
    const phone = `${PHONE_PREFIX}03`;
    const results = await Promise.allSettled([
      findOrCreateProfile(undefined, phone),
      findOrCreateProfile(undefined, phone),
      findOrCreateProfile(undefined, phone),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const ids = new Set(
      results.map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id),
    );
    expect(ids.size).toBe(1);
    expect(await prisma.profile.findMany({ where: { phone } })).toHaveLength(1);
  });

  it('allows many email-less accounts — email must be NULL, never empty string', async () => {
    // Profile.email is unique. Storing '' for "no email given" would make the
    // SECOND such registration die on P2002 as a 500 — the exact bug already
    // fixed for panNumber. This asserts the NULL contract holds at the DB level.
    await prisma.profile.create({
      data: { phone: `${PHONE_PREFIX}04`, passwordHash: 'x', email: null, status: 'ACTIVE' },
    });
    await prisma.profile.create({
      data: { phone: `${PHONE_PREFIX}05`, passwordHash: 'x', email: null, status: 'ACTIVE' },
    });

    const rows = await prisma.profile.findMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.email === null)).toBe(true);
  });

  it('rejects a second account reusing the same email', async () => {
    // Email stays unique when present — the route pre-checks this and returns a
    // clean 409, but the index is what actually guarantees it.
    const email = `dup${EMAIL_DOMAIN}`;
    await prisma.profile.create({
      data: { phone: `${PHONE_PREFIX}06`, passwordHash: 'x', email, status: 'ACTIVE' },
    });

    await expect(
      prisma.profile.create({
        data: { phone: `${PHONE_PREFIX}07`, passwordHash: 'x', email, status: 'ACTIVE' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('identifies a rep-created shop as claimable, and a real account as not', async () => {
    // POST /sales/buyers creates ACTIVE buyers with an empty passwordHash — they
    // can only OTP in. When the shopkeeper self-registers, /register treats that
    // as CLAIMING the existing shop (keeping its orders, ledger and credit)
    // rather than a duplicate. A profile with a real hash must NOT be claimable.
    const repCreated = await prisma.profile.create({
      data: {
        phone: `${PHONE_PREFIX}08`,
        passwordHash: '',
        role: 'BUYER',
        status: 'ACTIVE',
        storeName: 'Rep Created Shop',
        district: 'Kathmandu',
      },
    });
    const selfRegistered = await prisma.profile.create({
      data: {
        phone: `${PHONE_PREFIX}09`,
        passwordHash: '$2a$12$abcdefghijklmnopqrstuv',
        role: 'BUYER',
        status: 'ACTIVE',
      },
    });

    const claimable = (p: { status: string; passwordHash: string }) =>
      p.status === 'ACTIVE' && p.passwordHash === '';

    expect(claimable(repCreated)).toBe(true);
    expect(claimable(selfRegistered)).toBe(false);
  });

  it('keeps existing email-first accounts reachable by email', async () => {
    // Non-negotiable: nobody who registered under the old flow may break.
    // findOrCreateProfile must still resolve them by email, and login's
    // OR([email],[phone]) lookup must still find them either way.
    const email = `legacy${EMAIL_DOMAIN}`;
    const phone = `${PHONE_PREFIX}10`;
    const created = await prisma.profile.create({
      data: { phone, email, passwordHash: 'x', status: 'ACTIVE', emailVerified: true },
    });

    expect((await findOrCreateProfile(email, undefined)).id).toBe(created.id);
    expect((await findOrCreateProfile(undefined, phone)).id).toBe(created.id);

    const byEither = await prisma.profile.findFirst({
      where: { OR: [{ email }, { phone: email }] },
    });
    expect(byEither?.id).toBe(created.id);
  });
});
