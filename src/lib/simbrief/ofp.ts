import type {
  SimBriefAlternate,
  SimBriefErrorCode,
  SimBriefFetchResult,
  SimBriefFix,
  SimBriefOFP,
  SimBriefSigmet,
} from '@/types/simbrief';

/**
 * SimBrief OFP fetching and normalisation, shared by the main process (which talks to
 * simbrief.com) and the renderer (which reads the result). No Electron or DOM here.
 *
 * The fetcher is called with `json=v2`, the format SimBrief recommends: lists are always
 * arrays, missing values are empty strings or `false`, and durations come as `HH:MM:SS`.
 * The response is still normalised once in main so the renderer never guards against
 * a list that arrived as a single object or an empty placeholder.
 */

/** A SimBrief Pilot ID, as shown under Account Settings. */
export const SIMBRIEF_PILOT_ID_RE = /^\d{1,10}$/;
/** A Navigraph alias (SimBrief username): letters, digits, dot, dash and underscore. */
export const SIMBRIEF_USERNAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

/** True when the value can be sent to SimBrief, as a Pilot ID or as a username. */
export function isSimbriefUser(value: string): boolean {
  const trimmed = value.trim();
  return SIMBRIEF_PILOT_ID_RE.test(trimmed) || SIMBRIEF_USERNAME_RE.test(trimmed);
}

/** The fetcher URL for a Pilot ID (digits only) or a username (anything else). */
export function simbriefFetchUrl(user: string): string {
  const trimmed = user.trim();
  const param = SIMBRIEF_PILOT_ID_RE.test(trimmed) ? 'userid' : 'username';
  return `https://www.simbrief.com/api/xml.fetcher.php?${param}=${encodeURIComponent(trimmed)}&json=v2`;
}

/** What the main process got back from the network, before any SimBrief-specific parsing. */
export interface OfpHttpResult {
  data: string | null;
  error: string | null;
  statusCode?: number;
}

/**
 * The fetch result for the renderer. A SimBrief error status (HTTP 400 with
 * `fetch.status: "Error: ..."`) is mapped to a code the UI can translate; the raw message
 * stays in `error` for logs.
 */
export function parseOfpResponse(result: OfpHttpResult): SimBriefFetchResult {
  if (result.data === null) {
    return failure('network', result.error ?? 'No data received');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.data);
  } catch {
    return failure('bad_response', result.error ?? `HTTP ${result.statusCode ?? '?'}: not JSON`);
  }
  if (!isRecord(raw)) return failure('bad_response', 'Unexpected response shape');

  const status = isRecord(raw.fetch) ? text(raw.fetch.status) : '';
  if (/^error/i.test(status)) {
    const message = status.replace(/^error:\s*/i, '');
    return failure(errorCodeFor(message), message);
  }
  if (result.error) return failure('bad_response', result.error);
  if (!isRecord(raw.navlog) && !Array.isArray(raw.navlog)) {
    return failure('bad_response', 'Response has no navlog');
  }

  return { success: true, data: slimOfp(raw) };
}

function failure(code: SimBriefErrorCode, error: string): SimBriefFetchResult {
  return { success: false, code, error };
}

function errorCodeFor(message: string): SimBriefErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes('no flight plan')) return 'no_plan';
  if (lower.includes('unknown user') || lower.includes('invalid user')) return 'unknown_user';
  return 'bad_response';
}

/** Top-level sections the app never reads. Dropping them cuts the payload by about 85%. */
const UNUSED_SECTIONS = [
  'notams',
  'text',
  'images',
  'etops',
  'alternate_navlog',
  'takeoff_altn',
  'enroute_altn',
  'enroute_station',
  'crew',
] as const;

/**
 * The OFP the renderer works with: the unused sections dropped and every list the UI reads
 * guaranteed to be an array. Accepts the legacy `json=1` nesting too (`navlog.fix`,
 * `sigmets.sigmet`), so a cached or pasted old response still loads.
 */
export function slimOfp(raw: Record<string, unknown>): SimBriefOFP {
  const out: Record<string, unknown> = { ...raw };
  for (const key of UNUSED_SECTIONS) delete out[key];

  out.navlog = listOf<SimBriefFix>(raw.navlog, 'fix');
  out.alternate = listOf<Record<string, unknown>>(raw.alternate).map(normaliseAirport);
  out.sigmets = listOf<SimBriefSigmet>(raw.sigmets, 'sigmet').map((s) => ({
    ...s,
    qualifier: text(s.qualifier),
    hazard: text(s.hazard),
  }));
  if (isRecord(raw.origin)) out.origin = normaliseAirport(raw.origin);
  if (isRecord(raw.destination)) out.destination = normaliseAirport(raw.destination);
  if (isRecord(raw.atc)) out.atc = { ...raw.atc, fir_enroute: listOf<string>(raw.atc.fir_enroute) };
  if (isRecord(raw.tlr)) {
    const tlr = raw.tlr;
    out.tlr = {
      ...tlr,
      takeoff: isRecord(tlr.takeoff)
        ? { ...tlr.takeoff, runway: listOf(tlr.takeoff.runway) }
        : tlr.takeoff,
      landing: isRecord(tlr.landing)
        ? { ...tlr.landing, runway: listOf(tlr.landing.runway) }
        : tlr.landing,
    };
  }
  if (isRecord(raw.files)) {
    const { file: _file, ...files } = raw.files;
    out.files = files;
  }
  return out as unknown as SimBriefOFP;
}

/** NOTAMs as an array; the ATIS block is not shown anywhere. */
function normaliseAirport(airport: Record<string, unknown>): Record<string, unknown> {
  const { atis: _atis, ...rest } = airport;
  return { ...rest, notam: listOf(airport.notam) };
}

/**
 * A list however the fetcher wrote it: an array (v2), a single object (legacy, one item),
 * an empty placeholder (legacy, none), or nested under `key` (legacy `navlog.fix`).
 */
export function listOf<T>(value: unknown, key?: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const keys = Object.keys(value);
  if (keys.length === 0) return [];
  if (key && key in value) return listOf<T>(value[key]);
  return [value as T];
}

/** A string field as a string: v2 writes a missing one as `""`, `false` or `[]`. */
export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The alternate the plan is dispatched with; SimBrief lists extra alternates after it. */
export function primaryAlternate(ofp: SimBriefOFP): SimBriefAlternate | undefined {
  return ofp.alternate[0];
}

/**
 * Seconds from a SimBrief duration: `"13:17:31"` (v2), `"47851"` (legacy seconds) or a
 * number. `null` when the value is empty or unreadable.
 */
export function parseDurationSeconds(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const clock = value.match(/^(-?)(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    const [, sign, h, m, s] = clock;
    const total = Number(h) * 3600 + Number(m) * 60 + Number(s ?? 0);
    return sign === '-' ? -total : total;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds : null;
}

/** A Date from a SimBrief timestamp: ISO 8601 (v2) or epoch seconds (legacy). */
export function parseTimestamp(value: string | number | undefined | null): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const epoch = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : NaN;
  const date = Number.isFinite(epoch) ? new Date(epoch * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
