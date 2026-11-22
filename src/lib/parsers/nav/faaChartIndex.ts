/**
 * The FAA's terminal procedures index (d-tpp_Metafile.xml), read when the user places it in
 * Custom Data.
 *
 * X-Plane's CIFP (Laminar and Navigraph) codes an obstacle departure procedure exactly like a
 * SID; only the FAA's chart list says which departures are ODPs (chart code `ODP`, against `DP`
 * for a SID). Each chart carries its computer code (`MONMT3.JNC`), whose first part is the name
 * the CIFP uses. The app never ships or downloads this file; it is US only and the user keeps it
 * current.
 */

export type FaaObstacleDepartures = ReadonlyMap<string, ReadonlySet<string>>;

const AIRPORT_BLOCK = /<airport_name\b([^>]*)>([\s\S]*?)<\/airport_name>/g;
const attribute = (attributes: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1]?.trim().toUpperCase() ?? '';
const RECORD = /<record>([\s\S]*?)<\/record>/g;
const field = (record: string, tag: string) =>
  new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(record)?.[1]?.trim() ?? '';

/** The obstacle departures per airport, by the name the CIFP gives them. */
export function parseFaaObstacleDepartures(xml: string): FaaObstacleDepartures {
  const index = new Map<string, Set<string>>();
  for (const [, attributes, body] of xml.matchAll(AIRPORT_BLOCK)) {
    if (!attributes || !body) continue;
    // A small field has no ICAO code; X-Plane knows it by its FAA identifier.
    const icao = attribute(attributes, 'icao_ident') || attribute(attributes, 'apt_ident');
    if (!icao) continue;
    for (const [, record] of body.matchAll(RECORD)) {
      if (!record || field(record, 'chart_code') !== 'ODP') continue;
      // `MONMT3.JNC`: the procedure, then the fix it ends at. Some ODPs have no code at all.
      const name = field(record, 'faanfd18').split('.')[0]?.toUpperCase();
      if (!name) continue;
      let departures = index.get(icao);
      if (!departures) {
        departures = new Set();
        index.set(icao, departures);
      }
      departures.add(name);
    }
  }
  return index;
}

/** Marks each SID at the airport that the FAA charts as an obstacle departure. */
export function markObstacleDepartures(
  sids: { name: string; obstacle?: boolean }[],
  index: FaaObstacleDepartures,
  icao: string
): void {
  const departures = index.get(icao.trim().toUpperCase());
  if (!departures) return;
  for (const sid of sids) {
    if (departures.has(sid.name.trim().toUpperCase())) sid.obstacle = true;
  }
}
