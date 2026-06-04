// Single source of truth for the API base URL.
// Production builds set EXPO_PUBLIC_API_URL via eas.json; if it's missing we fall
// back to the production API but warn loudly in dev so a local build can't
// silently talk to production.
const FALLBACK_API_URL = "https://dis-production-00b5.up.railway.app/api";

const envUrl = process.env.EXPO_PUBLIC_API_URL;

if (!envUrl && __DEV__) {
  console.warn(
    "[DISTRO] EXPO_PUBLIC_API_URL is not set — falling back to the PRODUCTION API " +
      `(${FALLBACK_API_URL}). Set it in your .env / app config for local development.`
  );
}

/** Full API base, e.g. "https://host/api". */
export const API_URL = envUrl ?? FALLBACK_API_URL;

/** Server origin without the trailing "/api" — used to resolve relative asset paths. */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
