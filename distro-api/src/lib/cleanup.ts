import { prisma } from './prisma';

export async function cleanExpiredSessions(): Promise<void> {
  const deleted = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (deleted.count > 0) {
    console.log(`[CLEANUP] Removed ${deleted.count} expired sessions`);
  }
}

export async function cleanExpiredOtpCodes(): Promise<void> {
  const deleted = await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  });
  if (deleted.count > 0) {
    console.log(`[CLEANUP] Removed ${deleted.count} expired/used OTP codes`);
  }
}

export function startCleanupCron(): void {
  const runAll = async (): Promise<void> => {
    await cleanExpiredSessions();
    await cleanExpiredOtpCodes();
  };

  // Run once on boot, then hourly — OTP codes live 10 minutes, so a daily
  // sweep let dead rows pile up; hourly is the ceiling (never more frequent).
  runAll().catch((e) =>
    console.warn('[CLEANUP] Skipped — DB not ready:', e.message)
  );
  setInterval(
    () =>
      runAll().catch((e) =>
        console.warn('[CLEANUP] Failed:', e.message)
      ),
    60 * 60 * 1000
  );
}
