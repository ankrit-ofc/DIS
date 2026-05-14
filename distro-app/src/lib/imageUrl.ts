const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const ORIGIN = API_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${ORIGIN}${suffix}`;
}
