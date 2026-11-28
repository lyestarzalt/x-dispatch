import { isRecord } from '@/lib/utils/typeGuards';

/**
 * The FAA's terminal procedures index (d-tpp_Metafile.xml), downloaded per cycle
 * (`faaChartDownload.ts`).
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

/** One chart of an airport as the FAA lists it. */
export interface FaaChart {
  /** The FAA's chart code: `APD`, `IAP`, `DP`, `ODP`, `STR`, `MIN`, `HOT`, `LAH`, `DAU`. */
  code: string;
  /** The chart title, as printed ("ILS OR LOC RWY 16C"). */
  name: string;
  /** The PDF's file name in the cycle folder ("00582IL16C.PDF"). */
  pdf: string;
  /** True when the PDF carries its map position, so the chart can be laid over the map. */
  mapPosition: boolean;
}

/**
 * Whether a chart's PDF carries its map position. The FAA's own approach charts do (the
 * list marks them civil `C`, or `D` at a joint-use field); the Department of Defense's do not
 * (`N`, and the high-altitude `H`), nor do charted visual approaches or continuation pages.
 * Checked on 80 charts of cycle 2612: the only misses are a few military helicopter RNAV
 * approaches that have a position and are marked `N`.
 */
export function chartCarriesMapPosition(code: string, title: string, civil: string): boolean {
  if (code !== 'IAP' || (civil !== 'C' && civil !== 'D')) return false;
  return !/, CONT\.\d+$/.test(title) && !/\bVISUAL\b/.test(title);
}

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
  /** Every chart per airport, in the FAA's order. */
  charts: ReadonlyMap<string, readonly FaaChart[]>;
}

/** A PDF name is a plain file name; anything else would change where the link points. */
const PDF_NAME = /^[A-Za-z0-9_-]+\.PDF$/i;

/** Where the FAA serves a chart of the given cycle. */
export function faaChartUrl(cycle: string, pdf: string): string {
  return `https://aeronav.faa.gov/d-tpp/${cycle}/${pdf}`;
}

export type FaaChartGroup = 'airport' | 'departures' | 'arrivals' | 'approaches' | 'minimums';

const GROUP_ORDER: FaaChartGroup[] = [
  'airport',
  'departures',
  'arrivals',
  'approaches',
  'minimums',
];

function chartGroup(code: string): FaaChartGroup {
  switch (code) {
    case 'APD':
    case 'HOT':
    case 'LAH':
      return 'airport';
    case 'DP':
    case 'ODP':
      return 'departures';
    case 'STR':
      return 'arrivals';
    case 'IAP':
      return 'approaches';
    default:
      return 'minimums';
  }
}

/**
 * An airport's charts in the order a flight uses them: airport (diagram first), departures,
 * arrivals, approaches, minimums. Empty groups are left out.
 */
export function groupFaaCharts<T extends { code: string }>(
  charts: readonly T[]
): { group: FaaChartGroup; charts: T[] }[] {
  const byGroup = new Map<FaaChartGroup, T[]>();
  for (const chart of charts) {
    const group = chartGroup(chart.code);
    const list = byGroup.get(group) ?? [];
    // The diagram leads its group; the FAA lists hot spots before it.
    if (chart.code === 'APD') list.unshift(chart);
    else list.push(chart);
    byGroup.set(group, list);
  }
  return GROUP_ORDER.flatMap((group) => {
    const list = byGroup.get(group);
    return list ? [{ group, charts: list }] : [];
  });
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

/** Find a single primary approach plate. Keep different variants and COPTER plates distinct. */
export function findApproachChart<T extends { code: string; name: string }>(
  charts: readonly T[],
  identifier: string,
  displayName: string
): T | undefined {
  const normalize = (name: string) =>
    name
      .toUpperCase()
      .replace(/\bRWY 0(?=\d)/g, 'RWY ')
      .trim();
  const wanted = normalize(displayName);
  const plates = charts.filter((c) => c.code === 'IAP' && !/, CONT\.\s*\d+$/i.test(c.name));
  const exact = plates.filter((c) => normalize(c.name) === wanted);
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const combined = plates.filter((c) => ilsOrLocIdentifier(c.name) === identifier);
  return combined.length === 1 ? combined[0] : undefined;
}

/** What the chart list says about each airport's procedures, by their CIFP names. */
export function parseFaaChartIndex(xml: string): FaaChartIndex {
  const obstacleDepartures: NamesByAirport = new Map();
  const rnavDepartures: NamesByAirport = new Map();
  const rnavArrivals: NamesByAirport = new Map();
  const ilsOrLoc: NamesByAirport = new Map();
  const charts = new Map<string, FaaChart[]>();
  for (const [, attributes, body] of xml.matchAll(AIRPORT_BLOCK)) {
    if (!attributes || !body) continue;
    // A small field has no ICAO code; X-Plane knows it by its FAA identifier.
    const icao = attribute(attributes, 'icao_ident') || attribute(attributes, 'apt_ident');
    if (!icao) continue;
    for (const [, record] of body.matchAll(RECORD)) {
      if (!record) continue;
      const code = field(record, 'chart_code');
      const pdf = field(record, 'pdf_name');
      const title = field(record, 'chart_name');
      if (code && title && PDF_NAME.test(pdf)) {
        const list = charts.get(icao) ?? [];
        const mapPosition = chartCarriesMapPosition(code, title, field(record, 'civil'));
        list.push({ code, name: title, pdf, mapPosition });
        charts.set(icao, list);
      }
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
  return { cycle, obstacleDepartures, rnavDepartures, rnavArrivals, ilsOrLoc, charts };
}

/**
 * Whether the FAA charts a helicopter procedure at the airport: a COPTER approach, or a
 * departure titled (COPTER). Only then are its coded helicopter procedures worth asking for.
 */
export function hasCopterChart(index: FaaChartIndex, icao: string): boolean {
  const charts = index.charts.get(icao.trim().toUpperCase());
  return charts?.some((chart) => /\bCOPTER\b/.test(chart.name)) ?? false;
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
  /** Per airport, each chart as `[code, title, pdf, mapPosition]`. */
  charts: Record<string, [string, string, string, boolean][]>;
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
    charts: Object.fromEntries(
      [...index.charts].map(([icao, list]) => [
        icao,
        list.map((c) => [c.code, c.name, c.pdf, c.mapPosition]),
      ])
    ),
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
  // A cache from before charts were kept has none: it is not one, and is downloaded again.
  if (!isRecord(json.charts)) return null;
  const charts = new Map<string, FaaChart[]>();
  for (const [icao, list] of Object.entries(json.charts)) {
    if (!Array.isArray(list)) return null;
    const airport: FaaChart[] = [];
    for (const entry of list) {
      if (!Array.isArray(entry) || entry.length !== 4) return null;
      const [code, name, pdf, mapPosition] = entry as unknown[];
      if (typeof code !== 'string' || typeof name !== 'string' || typeof pdf !== 'string') {
        return null;
      }
      if (typeof mapPosition !== 'boolean' || !PDF_NAME.test(pdf)) return null;
      airport.push({ code, name, pdf, mapPosition });
    }
    charts.set(icao, airport);
  }
  return {
    cycle,
    charts,
    obstacleDepartures: lists.obstacleDepartures!,
    rnavDepartures: lists.rnavDepartures!,
    rnavArrivals: lists.rnavArrivals!,
    ilsOrLoc: lists.ilsOrLoc!,
  };
}

/**
 * The chart-title tags a SID or STAR carries, in the order a chart prints them:
 * "(OBSTACLE) (RNAV)", "(COPTER) (RNAV)". Each is a key under `procedures.` in the locales.
 */
export function chartTitleTags(p: {
  obstacle?: boolean;
  rnav?: boolean;
  helicopter?: boolean;
}): ('obstacle' | 'copter' | 'rnav')[] {
  return [
    ...(p.obstacle ? (['obstacle'] as const) : []),
    ...(p.helicopter ? (['copter'] as const) : []),
    ...(p.rnav ? (['rnav'] as const) : []),
  ];
}
