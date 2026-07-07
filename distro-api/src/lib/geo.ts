// Shop coordinates: hard WGS84 ranges plus a Nepal bounding-box sanity check —
// a wildly wrong pin (another continent, swapped lat/lng) is worse than none.
const NEPAL_LAT = { min: 26, max: 31 };
const NEPAL_LNG = { min: 80, max: 89 };

/**
 * Validates a lat/lng pair. Returns an error message, or null when valid.
 * Both values must be present together — a lone latitude is meaningless.
 */
export function validateCoords(lat: unknown, lng: unknown): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'latitude and longitude must both be numbers';
  }
  if (lat < -90 || lat > 90) return 'latitude must be between -90 and 90';
  if (lng < -180 || lng > 180) return 'longitude must be between -180 and 180';
  if (lat < NEPAL_LAT.min || lat > NEPAL_LAT.max || lng < NEPAL_LNG.min || lng > NEPAL_LNG.max) {
    return 'Location is outside Nepal — check the pin and try again';
  }
  return null;
}
