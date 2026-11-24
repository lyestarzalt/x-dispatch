import { isRecord } from '@/lib/utils/typeGuards';

/**
 * The FAA's terminal procedures index (d-tpp_Metafile.xml): downloaded per cycle
 * (`faaChartDownload.ts`), or the copy the user placed in Custom Data.
 *
 * X-Plane's CIFP (Laminar and Navigraph) codes an obstacle departure procedure exactly like a
 * SID, says nothing a pilot can read about a SID or STAR being RNAV, and codes a US
 * "ILS OR LOC RWY 4R" as the ILS alone. The FAA's chart list says all three: an obstacle
 * departure has chart code `ODP` (against `DP` for a SID), an RNAV procedure has "(RNAV)" in its
 * chart title, and an approach with localizer minima is titled "ILS OR LOC". Each departure and
 * arrival chart carries its computer code, which holds the name the CIFP uses: first for a
 * departure (`MONMT3.JNC`), last for an arrival (`BRODE.GRUUB1`). Approaches carry none, so
 * their CIFP identifier is built from the title (`ilsOrLocIdentifier`). US only.
 */

type NamesByAirport = Map<string, Set<string>>;

export interface FaaChartIndex {
  /** The AIRAC cycle the file is for ("2610"), from its header; null when it has none. */
  cycle: string | null;
  /** Departures the FAA charts as obstacle departures, per airport. */
  obstacleDepartures: ReadonlyMap<string, ReadonlySet<string>>;
  /** Departures titled (RNAV), per airport. */
  rnavDepartures: ReadonlyMap<string, ReadonlySet<string>>;
  /** Arrivals titled (RNAV), per airport. */
  rnavArrivals: ReadonlyMap<string, ReadonlySet<string>>;
  /** ILS approaches charted as ILS OR LOC, by their CIFP identifier (`I04R`), per airport. */
  ilsOrLoc: ReadonlyMap<string, ReadonlySet<string>>;
}

const CYCLE = /<digital_tpp\b[^>]*\bcycle="(\d{4})"/;
const AIRPORT_BLOCK = /<airport_name\b([^>]*)>([\s\S]*?)<\/airport_name>/g;
const RECORD = /<record>([\s\S]*?)<\/record>/g;
const attribute = (attributes: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1]?.trim().toUpperCase() ?? '';
const field = (record: string, tag: string) =>
  new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(record)?.[1]?.trim() ?? '';

function add(index: NamesByAirport, icao: string, name: string): void {
  let names = index.get(icao);
  if (!names) {
    names = new Set();
    index.set(icao, names);
  }
  names.add(name);
}

/**
 * The CIFP identifier of an approach the FAA titles ILS OR LOC: "ILS Y OR LOC Y RWY 05" is
 * `I05-Y`, "ILS Z OR LOC Z RWY 01L" is `I01LZ` (the variant follows a runway letter without a
 * dash). Null for any other title: an ILS whose localizer has a chart of its own
 * ("ILS RWY 08L" beside "LOC RWY 08L") is not one, and X-Plane's data has no helicopter
 * procedures to match a COPTER chart.
 */
export function ilsOrLocIdentifier(title: string): string | null {
  const name = title.trim().toUpperCase();
  if (name.startsWith('COPTER') || !/\bILS\b/.test(name) || !/\bOR LOC\b/.test(name)) {
    return null;
  }
  const runway = /\bRWY (\d{1,2})([LRC]?)\b/.exec(name);
  if (!runway?.[1]) return null;
  const side = runway[2] ?? '';
  const variant =
    /\bILS ([W-Z]) OR\b/.exec(name)?.[1] ?? /\bOR LOC(?:\/DME)? ([W-Z]) RWY\b/.exec(name)?.[1];
  const suffix = variant ? (side ? variant : `-${variant}`) : '';
  return `I${runway[1].padStart(2, '0')}${side}${suffix}`;
}

/** What the chart list says about each airport's procedures, by their CIFP names. */
export function parseFaaChartIndex(xml: string): FaaChartIndex {
  const obstacleDepartures: NamesByAirport = new Map();
  const rnavDepartures: NamesByAirport = new Map();
  const rnavArrivals: NamesByAirport = new Map();
  const ilsOrLoc: NamesByAirport = new Map();
  for (const [, attributes, body] of xml.matchAll(AIRPORT_BLOCK)) {
    if (!attributes || !body) continue;
    // A small field has no ICAO code; X-Plane knows it by its FAA identifier.
    const icao = attribute(attributes, 'icao_ident') || attribute(attributes, 'apt_ident');
    if (!icao) continue;
    for (const [, record] of body.matchAll(RECORD)) {
      if (!record) continue;
      const code = field(record, 'chart_code');
      if (code === 'IAP') {
        const identifier = ilsOrLocIdentifier(field(record, 'chart_name'));
        if (identifier) add(ilsOrLoc, icao, identifier);
        continue;
      }
      const departure = code === 'DP' || code === 'ODP';
      if (!departure && code !== 'STR') continue;
      // Some charts have no computer code at all; those cannot be matched.
      const parts = field(record, 'faanfd18').toUpperCase().split('.');
      const name = departure ? parts[0] : parts[parts.length - 1];
      if (!name) continue;
      if (code === 'ODP') add(obstacleDepartures, icao, name);
      if (field(record, 'chart_name').toUpperCase().includes('(RNAV)')) {
        add(departure ? rnavDepartures : rnavArrivals, icao, name);
      }
    }
  }
  const cycle = CYCLE.exec(xml)?.[1] ?? null;
  return { cycle, obstacleDepartures, rnavDepartures, rnavArrivals, ilsOrLoc };
}

interface Markable {
  name: string;
  obstacle?: boolean;
  rnav?: boolean;
}

/** Marks the airport's procedures with what the FAA's chart titles say about them. */
export function markFaaChartNames(
  procedures: {
    sids: Markable[];
    stars: Markable[];
    approaches?: { name: string; orLocalizer?: boolean }[];
  },
  index: FaaChartIndex,
  icao: string
): void {
  const airport = icao.trim().toUpperCase();
  const named = (names: ReadonlySet<string> | undefined, p: Markable) =>
    names?.has(p.name.trim().toUpperCase()) ?? false;
  for (const sid of procedures.sids) {
    if (named(index.obstacleDepartures.get(airport), sid)) sid.obstacle = true;
    if (named(index.rnavDepartures.get(airport), sid)) sid.rnav = true;
  }
  for (const star of procedures.stars) {
    if (named(index.rnavArrivals.get(airport), star)) star.rnav = true;
  }
  const ilsOrLoc = index.ilsOrLoc.get(airport);
  for (const approach of procedures.approaches ?? []) {
    if (ilsOrLoc?.has(approach.name.trim().toUpperCase())) approach.orLocalizer = true;
  }
}

/** The index as plain JSON, for the download cache. */
export interface FaaChartIndexJson {
  cycle: string | null;
  obstacleDepartures: Record<string, string[]>;
  rnavDepartures: Record<string, string[]>;
  rnavArrivals: Record<string, string[]>;
  ilsOrLoc: Record<string, string[]>;
}

const LISTS = ['obstacleDepartures', 'rnavDepartures', 'rnavArrivals', 'ilsOrLoc'] as const;

export function faaChartIndexToJson(index: FaaChartIndex): FaaChartIndexJson {
  const plain = (map: ReadonlyMap<string, ReadonlySet<string>>) =>
    Object.fromEntries([...map].map(([icao, names]) => [icao, [...names]]));
  return {
    cycle: index.cycle,
    obstacleDepartures: plain(index.obstacleDepartures),
    rnavDepartures: plain(index.rnavDepartures),
    rnavArrivals: plain(index.rnavArrivals),
    ilsOrLoc: plain(index.ilsOrLoc),
  };
}

/** The index back from the download cache, or null when the cache is not one. */
export function faaChartIndexFromJson(json: unknown): FaaChartIndex | null {
  if (!isRecord(json)) return null;
  const { cycle } = json;
  if (cycle !== null && (typeof cycle !== 'string' || !/^\d{4}$/.test(cycle))) return null;
  const lists: Partial<Record<(typeof LISTS)[number], NamesByAirport>> = {};
  for (const key of LISTS) {
    const value = json[key];
    if (!isRecord(value)) return null;
    const map: NamesByAirport = new Map();
    for (const [icao, names] of Object.entries(value)) {
      if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) return null;
      map.set(icao, new Set(names));
    }
    lists[key] = map;
  }
  return {
    cycle,
    obstacleDepartures: lists.obstacleDepartures!,
    rnavDepartures: lists.rnavDepartures!,
    rnavArrivals: lists.rnavArrivals!,
    ilsOrLoc: lists.ilsOrLoc!,
  };
}

/**
 * The chart-title tags a SID or STAR carries, in the order a chart prints them:
 * "(OBSTACLE) (RNAV)". Each is a key under `procedures.` in the locales.
 */
export function chartTitleTags(p: { obstacle?: boolean; rnav?: boolean }): ('obstacle' | 'rnav')[] {
  return [...(p.obstacle ? (['obstacle'] as const) : []), ...(p.rnav ? (['rnav'] as const) : [])];
}
