const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/api\/?$/, "");

/** Convert a stored imageUrl (relative "/uploads/..." or full "http://...") to a usable URI. */
export function imgUri(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return API_BASE + path;
}
