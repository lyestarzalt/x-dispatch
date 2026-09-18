/**
 * Sun geometry shared by the sky lighting and the city-light layers.
 *
 * Same low-precision model as suncalc (Meeus-style mean elements, no
 * nutation, no refraction). suncalc only exposes observer-relative results,
 * and the layers also need the subsolar point, so the few formulas involved
 * live here and the test suite checks them against suncalc.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SunPosition {
  /** Degrees above the horizon, negative below. */
  altitude: number;
  /** Compass bearing of the sun, degrees clockwise from north. */
  azimuth: number;
}

const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const OBLIQUITY = RAD * 23.4397;

/** Sun altitude at which the city lights are fully on (civil dusk). */
const LIGHTS_FULL_ON_ALTITUDE = -6;
/** Sun altitude at which the city lights start to come on. */
const LIGHTS_OFF_ALTITUDE = 0;

interface SunCoords {
  /** Declination, radians. */
  dec: number;
  /** Right ascension, radians. */
  ra: number;
  /** Greenwich mean sidereal angle, radians. */
  gmst: number;
}

function toDays(timeMs: number): number {
  return timeMs / DAY_MS - 0.5 + J1970 - J2000;
}

function sunCoords(timeMs: number): SunCoords {
  const d = toDays(timeMs);
  const meanAnomaly = RAD * (357.5291 + 0.98560028 * d);
  const equationOfCenter =
    RAD *
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly));
  const perihelion = RAD * 102.9372;
  const eclipticLon = meanAnomaly + equationOfCenter + perihelion + Math.PI;

  return {
    dec: Math.asin(Math.sin(OBLIQUITY) * Math.sin(eclipticLon)),
    ra: Math.atan2(Math.sin(eclipticLon) * Math.cos(OBLIQUITY), Math.cos(eclipticLon)),
    gmst: RAD * (280.16 + 360.9856235 * d),
  };
}

export function normalizeLongitude(lon: number): number {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  // Keep the antimeridian on the positive side so a polygon that starts
  // there does not flip between -180 and 180 on consecutive frames.
  return wrapped === -180 ? 180 : wrapped;
}

/** Point on Earth where the sun is directly overhead. */
export function subsolarPoint(timeMs: number): GeoPoint {
  const { dec, ra, gmst } = sunCoords(timeMs);
  return { lat: dec * DEG, lon: normalizeLongitude((ra - gmst) * DEG) };
}

/**
 * Per-call precomputation for evaluating the sun altitude at many points
 * for the same instant, as the city-light points do each tick.
 */
export interface SunAltitudeEvaluator {
  altitudeAt: (lat: number, lon: number) => number;
}

export function sunAltitudeEvaluator(timeMs: number): SunAltitudeEvaluator {
  const { dec, ra, gmst } = sunCoords(timeMs);
  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  return {
    altitudeAt(lat, lon) {
      const phi = lat * RAD;
      const hourAngle = gmst + lon * RAD - ra;
      return Math.asin(Math.sin(phi) * sinDec + Math.cos(phi) * cosDec * Math.cos(hourAngle)) * DEG;
    },
  };
}

/** Sun altitude and compass azimuth as seen from an observer. */
export function sunPosition(timeMs: number, lat: number, lon: number): SunPosition {
  const { dec, ra, gmst } = sunCoords(timeMs);
  const phi = lat * RAD;
  const hourAngle = gmst + lon * RAD - ra;
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle)
  );
  // Measured from south, positive towards west (suncalc convention), then
  // turned into a compass bearing.
  const fromSouth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
  );
  const azimuth = (fromSouth * DEG + 180 + 360) % 360;
  return { altitude: altitude * DEG, azimuth };
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * 0 while the sun is up, 1 once it is six degrees below the horizon, with a
 * smooth ramp between. Drives every night-only effect so they come on
 * together.
 */
export function nightFactor(sunAltitude: number): number {
  return smoothstep(
    (LIGHTS_OFF_ALTITUDE - sunAltitude) / (LIGHTS_OFF_ALTITUDE - LIGHTS_FULL_ON_ALTITUDE)
  );
}

/**
 * X-Plane exposes the simulator clock as a zero-based day of year plus
 * seconds since midnight UTC, without a year. The current year is close
 * enough: the sun's declination for a given day barely changes between
 * years.
 */
export function simTimeToEpochMs(dayOfYear: number, zuluSeconds: number, year: number): number {
  return Date.UTC(year, 0, 1) + dayOfYear * DAY_MS + zuluSeconds * 1000;
}
