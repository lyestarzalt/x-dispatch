export function isValidICAO(icao: unknown): icao is string {
  if (typeof icao !== 'string') return false;
  return /^[A-Z0-9]{3,4}$/i.test(icao);
}

function isValidLatitude(lat: unknown): lat is number {
  if (typeof lat !== 'number' || isNaN(lat)) return false;
  return lat >= -90 && lat <= 90;
}

function isValidLongitude(lon: unknown): lon is number {
  if (typeof lon !== 'number' || isNaN(lon)) return false;
  return lon >= -180 && lon <= 180;
}

function isValidRadius(radius: unknown, maxRadius = 500): radius is number {
  if (typeof radius !== 'number' || isNaN(radius)) return false;
  return radius > 0 && radius <= maxRadius;
}

export function isValidSceneryId(id: unknown): id is number {
  if (typeof id !== 'number' || isNaN(id)) return false;
  return Number.isInteger(id) && id > 0;
}

export function isValidSearchQuery(query: unknown): query is string {
  if (typeof query !== 'string') return false;
  if (query.length === 0 || query.length > 100) return false;
  // Only allow alphanumeric, spaces, and basic punctuation
  return /^[A-Za-z0-9\s\-_.]+$/.test(query);
}

export function isValidRunway(runway: unknown): runway is string {
  if (typeof runway !== 'string') return false;
  return /^[0-9]{1,2}[LCR]?$/i.test(runway);
}

function isValidPath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > 1000) return false;
  // No null bytes or other dangerous characters
  return !path.includes('\0');
}

type ValidCoords = { valid: true; lat: number; lon: number; radius: number };
type InvalidCoords = { valid: false; error: string };
type CoordValidationResult = ValidCoords | InvalidCoords;

export function validateCoordinates(
  lat: unknown,
  lon: unknown,
  radiusNm: unknown
): CoordValidationResult {
  if (!isValidLatitude(lat)) {
    return { valid: false, error: 'Invalid latitude' };
  }
  if (!isValidLongitude(lon)) {
    return { valid: false, error: 'Invalid longitude' };
  }
  if (!isValidRadius(radiusNm)) {
    return { valid: false, error: 'Invalid radius (must be 0-500nm)' };
  }
  return { valid: true, lat, lon, radius: radiusNm };
}

export function isInvalidCoords(result: CoordValidationResult): result is InvalidCoords {
  return !result.valid;
}
