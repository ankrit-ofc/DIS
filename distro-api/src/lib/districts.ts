import { prisma } from './prisma';

/**
 * Server-side enforcement of the delivery area. Client dropdowns only show
 * active districts, but any endpoint accepting a district name must reject
 * inactive/unknown ones — filtering in the UI alone is not enforcement.
 *
 * Returns null when the district is active, else a client-safe error message.
 */
export async function validateActiveDistrict(name: string): Promise<string | null> {
  const district = await prisma.district.findUnique({
    where: { name },
    select: { active: true },
  });
  if (!district) return 'Unknown district';
  if (!district.active) {
    return `We currently deliver only within the Kathmandu Valley — ${name} is not served yet.`;
  }
  return null;
}
