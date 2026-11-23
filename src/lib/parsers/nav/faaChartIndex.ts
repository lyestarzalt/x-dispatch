/**
 * The FAA's terminal procedures index (d-tpp_Metafile.xml), read when the user places it in
 * Custom Data.
 *
 * X-Plane's CIFP (Laminar and Navigraph) codes an obstacle departure procedure exactly like a
 * SID, and says nothing a pilot can read about a SID or STAR being RNAV. The FAA's chart list
 * does: an obstacle departure has chart code `ODP` (against `DP` for a SID), and an RNAV
 * procedure has "(RNAV)" in its chart title. Each chart carries its computer code, which holds
 * the name the CIFP uses: first for a departure (`MONMT3.JNC`), last for an arrival
 * (`BRODE.GRUUB1`). The app never ships or downloads this file; it is US only and the user keeps
 * it current.
 */

type NamesByAirport = Map<string, Set<string>>;

export interface FaaChartIndex {
  /** Departures the FAA charts as obstacle departures, per airport. */
  obstacleDepartures: ReadonlyMap<string, ReadonlySet<string>>;
  /** Departures titled (RNAV), per airport. */
  rnavDepartures: ReadonlyMap<string, ReadonlySet<string>>;
  /** Arrivals titled (RNAV), per airport. */
  rnavArrivals: ReadonlyMap<string, ReadonlySet<string>>;
}

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

/** What the chart list says about each airport's departures and arrivals, by their CIFP names. */
export function parseFaaChartIndex(xml: string): FaaChartIndex {
  const obstacleDepartures: NamesByAirport = new Map();
  const rnavDepartures: NamesByAirport = new Map();
  const rnavArrivals: NamesByAirport = new Map();
  for (const [, attributes, body] of xml.matchAll(AIRPORT_BLOCK)) {
    if (!attributes || !body) continue;
    // A small field has no ICAO code; X-Plane knows it by its FAA identifier.
    const icao = attribute(attributes, 'icao_ident') || attribute(attributes, 'apt_ident');
    if (!icao) continue;
    for (const [, record] of body.matchAll(RECORD)) {
      if (!record) continue;
      const code = field(record, 'chart_code');
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
  return { obstacleDepartures, rnavDepartures, rnavArrivals };
}

interface Markable {
  name: string;
  obstacle?: boolean;
  rnav?: boolean;
}

/** Marks the airport's SIDs and STARs with what the FAA's chart titles say about them. */
export function markFaaChartNames(
  procedures: { sids: Markable[]; stars: Markable[] },
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
}

/**
 * The chart-title tags a SID or STAR carries, in the order a chart prints them:
 * "(OBSTACLE) (RNAV)". Each is a key under `procedures.` in the locales.
 */
export function chartTitleTags(p: { obstacle?: boolean; rnav?: boolean }): ('obstacle' | 'rnav')[] {
  return [...(p.obstacle ? (['obstacle'] as const) : []), ...(p.rnav ? (['rnav'] as const) : [])];
}
