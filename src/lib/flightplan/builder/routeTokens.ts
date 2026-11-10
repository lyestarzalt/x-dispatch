/**
 * Route string lexing. Pure and synchronous so it can run in the renderer for
 * instant feedback; the resolver in the main process does the database work.
 */

const AIRWAY_RE = /^[A-Z]{1,2}\d{1,4}[A-Z]?$/;
/** North Atlantic organised tracks are filed by designator, NATA to NATZ, like an airway. */
export const NAT_TRACK_RE = /^NAT[A-Z]$/;
const DIRECT_TOKENS = new Set(['DCT', 'DRCT', 'DIRECT']);
/** ICAO speed and level change after a fix: VALKU/N0475F350, 43N040W/M082F380, SUGOL/N0120VFR. */
const SPEED_LEVEL_RE = /^[NMK]\d{3,4}(?:[FASM]\d{3,4}|VFR)$/;
/** A SID or STAR identifier: three to five letters, a digit, an optional letter (VIICE2, MODRU2T). */
const PROCEDURE_RE = /^[A-Z]{3,5}\d[A-Z]?$/;
/** 5230N01000E, 52N010E, 5230N01000W */
const LATLON_DDMM_RE = /^(\d{2})(\d{2})?([NS])(\d{3})(\d{2})?([EW])$/;
/** 52.5/10.25 or 52.5,-10.25 */
const LATLON_DECIMAL_RE = /^(-?\d{1,2}(?:\.\d+)?)[/,](-?\d{1,3}(?:\.\d+)?)$/;

export type LexedKind = 'ident' | 'airway' | 'latlon' | 'direct';

export interface LexedToken {
  text: string;
  kind: LexedKind;
  latLon?: { latitude: number; longitude: number };
  /** As typed, when a speed and level note was dropped from it. */
  original?: string;
}

/** Looks like a SID or STAR name rather than a fix or an airway. */
export function isProcedureName(text: string): boolean {
  return PROCEDURE_RE.test(text);
}

/** "VALKU/N0475F350" → VALKU with the note set aside; anything else comes back as is. */
function dropSpeedLevel(raw: string): { text: string; original?: string } {
  const slash = raw.indexOf('/');
  if (slash <= 0) return { text: raw };
  const suffix = raw.slice(slash + 1);
  return SPEED_LEVEL_RE.test(suffix) ? { text: raw.slice(0, slash), original: raw } : { text: raw };
}

export function tokenizeRoute(routeText: string): string[] {
  return routeText
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** One end of a route for the clipboard: the airport, its runway and its SID or STAR. */
export interface ClipboardRouteEnd {
  icao: string;
  runway?: string;
  procedure?: string;
}

function sameAirport(token: string | undefined, icao: string): boolean {
  return token?.split('/')[0] === icao;
}

/**
 * The route as one upper-case line in the shape SimBrief's "Copy for Charts"
 * gives and chart apps take: `CYUL/24L CYUL5 BOBKI DCT MELTI RAGID6 CYYZ/23`.
 * Airports and procedures already typed into the route are not repeated. Split
 * on whitespace only: a comma joins a decimal coordinate.
 */
export function routeForClipboard(
  routeText: string,
  departure?: ClipboardRouteEnd | null,
  arrival?: ClipboardRouteEnd | null
): string {
  let tokens = routeText.toUpperCase().split(/\s+/).filter(Boolean);
  const from = departure?.icao.toUpperCase();
  const to = arrival?.icao.toUpperCase();
  if (from && sameAirport(tokens[0], from)) tokens = tokens.slice(1);
  if (to && sameAirport(tokens[tokens.length - 1], to)) tokens = tokens.slice(0, -1);

  const sid = departure?.procedure?.toUpperCase();
  if (sid && tokens[0] !== sid) tokens = [sid, ...tokens];
  const star = arrival?.procedure?.toUpperCase();
  if (star && tokens[tokens.length - 1] !== star) tokens = [...tokens, star];

  const airport = (icao: string, runway?: string) =>
    runway ? `${icao}/${runway.toUpperCase()}` : icao;
  return [
    ...(from ? [airport(from, departure?.runway)] : []),
    ...tokens,
    ...(to ? [airport(to, arrival?.runway)] : []),
  ].join(' ');
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
  for (const raw of tokenizeRoute(routeText)) {
    const { text, original } = dropSpeedLevel(raw);
    if (DIRECT_TOKENS.has(text)) {
      out.push({ text, kind: 'direct' });
      continue;
    }
    const latLon = parseLatLon(text);
    if (latLon) {
      out.push({ text, kind: 'latlon', latLon, original });
      continue;
    }
    const prev = out[out.length - 1];
    if ((AIRWAY_RE.test(text) || NAT_TRACK_RE.test(text)) && prev?.kind !== 'airway') {
      out.push({ text, kind: 'airway', original });
      continue;
    }
    out.push({ text, kind: 'ident', original });
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
