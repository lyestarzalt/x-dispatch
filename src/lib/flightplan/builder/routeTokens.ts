/**
 * Route string lexing. Pure and synchronous so it can run in the renderer for
 * instant feedback; the resolver in the main process does the database work.
 */

const AIRWAY_RE = /^[A-Z]{1,2}\d{1,4}[A-Z]?$/;
/** North Atlantic organised tracks are filed by designator, NATA to NATZ, like an airway. */
export const NAT_TRACK_RE = /^NAT[A-Z]$/;
const DIRECT_TOKENS = new Set(['DCT', 'DRCT', 'DIRECT']);
/** 5230N01000E, 52N010E, 5230N01000W */
const LATLON_DDMM_RE = /^(\d{2})(\d{2})?([NS])(\d{3})(\d{2})?([EW])$/;
/** 52.5/10.25 or 52.5,-10.25 */
const LATLON_DECIMAL_RE = /^(-?\d{1,2}(?:\.\d+)?)[/,](-?\d{1,3}(?:\.\d+)?)$/;

export type LexedKind = 'ident' | 'airway' | 'latlon' | 'direct';

export interface LexedToken {
  text: string;
  kind: LexedKind;
  latLon?: { latitude: number; longitude: number };
}

export function tokenizeRoute(routeText: string): string[] {
  return routeText
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseLatLon(token: string): { latitude: number; longitude: number } | null {
  const ddmm = LATLON_DDMM_RE.exec(token);
  if (ddmm) {
    const [, latDeg, latMin, ns, lonDeg, lonMin, ew] = ddmm;
    const lat = Number(latDeg) + Number(latMin ?? 0) / 60;
    const lon = Number(lonDeg) + Number(lonMin ?? 0) / 60;
    if (lat > 90 || lon > 180) return null;
    return { latitude: ns === 'S' ? -lat : lat, longitude: ew === 'W' ? -lon : lon };
  }
  const dec = LATLON_DECIMAL_RE.exec(token);
  if (dec) {
    const lat = Number(dec[1]);
    const lon = Number(dec[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { latitude: lat, longitude: lon };
  }
  return null;
}

/** Airways carry digits, idents almost never do; an airway straight after an airway is an ident. */
export function lexRoute(routeText: string): LexedToken[] {
  const out: LexedToken[] = [];
  for (const text of tokenizeRoute(routeText)) {
    if (DIRECT_TOKENS.has(text)) {
      out.push({ text, kind: 'direct' });
      continue;
    }
    const latLon = parseLatLon(text);
    if (latLon) {
      out.push({ text, kind: 'latlon', latLon });
      continue;
    }
    const prev = out[out.length - 1];
    if ((AIRWAY_RE.test(text) || NAT_TRACK_RE.test(text)) && prev?.kind !== 'airway') {
      out.push({ text, kind: 'airway' });
      continue;
    }
    out.push({ text, kind: 'ident' });
  }
  return out;
}

/** Drops the airport identifiers people habitually type at either end of a route. */
export function stripEndpoints(tokens: LexedToken[], departureIcao: string, arrivalIcao: string) {
  let list = tokens;
  if (list[0]?.text === departureIcao.toUpperCase()) list = list.slice(1);
  if (list[list.length - 1]?.text === arrivalIcao.toUpperCase()) list = list.slice(0, -1);
  return list;
}
