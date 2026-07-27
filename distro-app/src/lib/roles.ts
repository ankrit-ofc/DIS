/**
 * Roles the mobile app can host: BUYER (shopkeepers) and SALES (DISTRO field
 * reps). ADMIN and DRIVER are rejected — admin lives on distronepal.com.
 *
 * Kept dependency-free so both the auth store and the session helper can import
 * it without a cycle.
 */
export const MOBILE_ROLES = ["BUYER", "SALES"] as const;

export type MobileRole = (typeof MOBILE_ROLES)[number];

export function isMobileRole(role: unknown): role is MobileRole {
  return MOBILE_ROLES.includes(role as MobileRole);
}
