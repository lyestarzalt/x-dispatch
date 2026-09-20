/**
 * Parser for the bulk VATSIM METAR feed (metar.vatsim.net/metar.php?id=all).
 *
 * One METAR per line, roughly 5-8k stations. Reports are not all issued at the
 * same time and the feed keeps stale ones, so callers get an ageMinutes and can
 * drop anything too old to count as current.
 */

export type WeatherCategory =
  | 'snow'
  | 'fog'
  | 'lowVisibility'
  | 'lowCeiling'
  | 'heavyPrecipitation'
  | 'freezing'
  | 'thunderstorm'
  | 'severe'
  | 'dustSand'
  | 'strongWind'
  | 'clear';

export interface MetarObservation {
  icao: string;
  /** Day-of-month and time from the report, e.g. 201455Z */
  issued: string;
  ageMinutes: number;
  raw: string;
  categories: WeatherCategory[];
  /** Horizontal visibility in metres, null when the report omits it */
  visibilityMetres: number | null;
  visibilityLabel: string | null;
  /** Base of the lowest broken/overcast layer in feet, null when none reported */
  ceilingFeet: number | null;
  /** Present-weather groups that triggered a category */
  phenomena: string[];
  windLabel: string | null;
  gustKt: number | null;
}

const STATION = /^[A-Z][A-Z0-9]{3}$/;
const ISSUED = /^(\d{2})(\d{2})(\d{2})Z$/;

// Present-weather groups: intensity or proximity prefix, then descriptors,
// then the phenomenon itself.
const SNOW = /^(?:[+-]|VC)?(?:MI|BC|PR|DR|BL|SH|TS|FZ|RE)*(?:SN|SG|PL|IC)(?:SN|RA|GS|GR)?$/;
const FOG = /^(?:[+-]|VC)?(?:MI|BC|PR|FZ)?FG$/;
const THUNDER = /^(?:[+-]|VC)?TS(?:RA|GR|GS|SN|PL)?$/;
const HEAVY = /^\+(?:MI|BC|PR|DR|BL|SH|TS|FZ)*(?:RA|DZ|SN|GR|GS|PL)(?:RA|DZ|SN|GR|GS)?$/;
// Freezing precipitation and freezing fog: airframe icing, the condition with
// the least margin for error of anything a METAR reports.
const FREEZING = /^(?:[+-]|VC)?FZ(?:RA|DZ|FG)$/;
// Hail, squalls and funnel clouds.
const SEVERE = /^(?:[+-]|VC)?(?:SH|TS)?(?:GR|GS)$|^SQ$|^\+?FC$/;
const DUST_SAND = /^(?:[+-]|VC)?(?:DS|SS|BLDU|BLSA|DRDU|DRSA|PO|DU|SA)$/;
const NO_SIGNIFICANT_CLOUD = /^(?:SKC|CLR|NSC|NCD)$/;

const WIND = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/;
const VIS_METRES = /^(\d{4})$/;
// Cloud layer: cover, then base in hundreds of feet. /// appears when an
// automated station cannot determine the base.
const CLOUD = /^(FEW|SCT|BKN|OVC|VV)(\d{3})$/;

const LOW_VISIBILITY_METRES = 1500;
const LOW_CEILING_FEET = 500;
const CLEAR_VISIBILITY_METRES = 9999;
const STRONG_WIND_KT = 25;
const STATUTE_MILE_METRES = 1609.34;

/**
 * Drop the remarks section. Remarks are free-form and contain tokens that look
 * exactly like present weather: automated stations emit TSNO ("thunderstorm
 * information not available"), which a naive snow test matches.
 */
function observationBody(tokens: string[]): string[] {
  const rmk = tokens.indexOf('RMK');
  return rmk === -1 ? tokens : tokens.slice(0, rmk);
}

/**
 * Trend groups describe what the weather is expected to do, not what it is
 * doing, so TEMPO 2000 +TSRA must not be reported as heavy rain right now.
 */
function currentConditions(body: string[]): string[] {
  const trend = body.findIndex((t) => t === 'TEMPO' || t === 'BECMG' || t === 'NOSIG');
  return trend === -1 ? body : body.slice(0, trend);
}

function parseFraction(value: string): number | null {
  const [numerator, denominator] = value.split('/');
  if (denominator === undefined) {
    const whole = Number(numerator);
    return Number.isFinite(whole) ? whole : null;
  }
  const n = Number(numerator);
  const d = Number(denominator);
  return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : null;
}

function formatMiles(miles: number): string {
  if (Number.isInteger(miles)) return String(miles);
  const eighths = Math.round(miles * 8);
  if (Math.abs(miles - eighths / 8) < 1e-9) {
    const whole = Math.floor(eighths / 8);
    const remainder = eighths % 8;
    const divisor = 8 / gcd(remainder, 8);
    const numerator = remainder / gcd(remainder, 8);
    const fraction = numerator + '/' + divisor;
    return whole > 0 ? whole + ' ' + fraction : fraction;
  }
  return miles.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Visibility in metres. Statute-mile visibility below one mile is written as a
 * bare fraction, but above it the value is split across two tokens: 2 1/2SM is
 * two and a half miles, not half a mile. Reading only the fraction understates
 * visibility badly enough to mark a clear field as near-zero.
 */
function parseVisibility(body: string[]): { metres: number; label: string } | null {
  for (let i = 0; i < body.length; i++) {
    const token = body[i]!;

    if (token.endsWith('SM')) {
      const lessThan = token.startsWith('M');
      const value = token.slice(0, -2).replace(/^[MP]/, '');
      let miles = parseFraction(value);
      if (miles === null) continue;

      const previous = body[i - 1];
      if (value.includes('/') && previous !== undefined && /^\d{1,2}$/.test(previous)) {
        miles += Number(previous);
      }
      return {
        metres: miles * STATUTE_MILE_METRES,
        label: (lessThan ? '<' : '') + formatMiles(miles) + 'SM',
      };
    }

    // Metre visibility never occupies the first body slot (that is wind), which
    // stops a cloud or time group being read as visibility.
    if (i >= 1 && VIS_METRES.test(token)) {
      return { metres: Number(token), label: token + 'm' };
    }
  }
  return null;
}

/**
 * Ceiling in feet: the base of the lowest broken or overcast layer. Scattered
 * and few layers are not a ceiling, and VV (vertical visibility) is treated as
 * one because it means the sky is obscured entirely.
 */
function parseCeilingFeet(body: string[]): number | null {
  let ceiling: number | null = null;
  for (const token of body) {
    const cloud = CLOUD.exec(token);
    if (!cloud) continue;
    const cover = cloud[1]!;
    if (cover === 'FEW' || cover === 'SCT') continue;
    const feet = Number(cloud[2]) * 100;
    if (ceiling === null || feet < ceiling) ceiling = feet;
  }
  return ceiling;
}

function ageInMinutes(day: number, hour: number, minute: number, now: Date): number {
  const issued = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute));
  // A report dated later than now was issued last month.
  if (issued.getTime() - now.getTime() > 12 * 60 * 60 * 1000) {
    issued.setUTCMonth(issued.getUTCMonth() - 1);
  }
  return Math.round((now.getTime() - issued.getTime()) / 60_000);
}

export function parseMetarLine(line: string, now: Date = new Date()): MetarObservation | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 3) return null;

  const icao = tokens[0]!;
  if (!STATION.test(icao)) return null;

  const issuedMatch = ISSUED.exec(tokens[1]!);
  if (!issuedMatch) return null;

  const body = currentConditions(observationBody(tokens.slice(2)));
  const cavok = body.includes('CAVOK');
  const visibility = cavok
    ? { metres: CLEAR_VISIBILITY_METRES, label: 'CAVOK' }
    : parseVisibility(body);
  const ceilingFeet = parseCeilingFeet(body);

  const phenomena = body.filter(
    (t) =>
      SNOW.test(t) ||
      FOG.test(t) ||
      THUNDER.test(t) ||
      HEAVY.test(t) ||
      FREEZING.test(t) ||
      SEVERE.test(t) ||
      DUST_SAND.test(t)
  );

  let windLabel: string | null = null;
  let gustKt: number | null = null;
  let speedKt = 0;
  for (const token of body) {
    const wind = WIND.exec(token);
    if (!wind) continue;
    windLabel = token;
    speedKt = Number(wind[2]);
    gustKt = wind[3] ? Number(wind[3]) : null;
    break;
  }

  const categories: WeatherCategory[] = [];
  if (body.some((t) => SNOW.test(t))) categories.push('snow');
  if (body.some((t) => FOG.test(t))) categories.push('fog');
  if (body.some((t) => HEAVY.test(t))) categories.push('heavyPrecipitation');
  if (body.some((t) => FREEZING.test(t))) categories.push('freezing');
  if (body.some((t) => THUNDER.test(t))) categories.push('thunderstorm');
  if (body.some((t) => SEVERE.test(t))) categories.push('severe');
  if (body.some((t) => DUST_SAND.test(t))) categories.push('dustSand');
  if (visibility !== null && visibility.metres <= LOW_VISIBILITY_METRES) {
    categories.push('lowVisibility');
  }
  if (ceilingFeet !== null && ceilingFeet <= LOW_CEILING_FEET) categories.push('lowCeiling');
  if (Math.max(speedKt, gustKt ?? 0) >= STRONG_WIND_KT) categories.push('strongWind');

  // Nothing to report is itself worth reporting: CAVOK, or good visibility with
  // no ceiling, no significant cloud and no present weather at all.
  const unlimitedVisibility = visibility !== null && visibility.metres >= CLEAR_VISIBILITY_METRES;
  if (
    categories.length === 0 &&
    (cavok ||
      (unlimitedVisibility &&
        ceilingFeet === null &&
        body.some((t) => NO_SIGNIFICANT_CLOUD.test(t))))
  ) {
    categories.push('clear');
  }

  return {
    icao,
    issued: tokens[1]!,
    ageMinutes: ageInMinutes(
      Number(issuedMatch[1]),
      Number(issuedMatch[2]),
      Number(issuedMatch[3]),
      now
    ),
    raw: line.trim(),
    categories,
    visibilityMetres: visibility?.metres ?? null,
    visibilityLabel: visibility?.label ?? null,
    ceilingFeet,
    phenomena,
    windLabel,
    gustKt,
  };
}

export interface ParseFeedOptions {
  /** Reports older than this are dropped. Defaults to 3 hours. */
  maxAgeMinutes?: number;
  now?: Date;
}

/** Parse the whole feed, keeping recent reports that matched at least one category. */
export function parseMetarFeed(feed: string, options: ParseFeedOptions = {}): MetarObservation[] {
  const { maxAgeMinutes = 180, now = new Date() } = options;

  const observations: MetarObservation[] = [];
  for (const line of feed.split('\n')) {
    const observation = parseMetarLine(line, now);
    if (!observation) continue;
    if (observation.ageMinutes > maxAgeMinutes || observation.ageMinutes < -60) continue;
    if (observation.categories.length === 0) continue;
    observations.push(observation);
  }
  return observations;
}
