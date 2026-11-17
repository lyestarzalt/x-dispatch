/**
 * The FAA's CIFP procedure index (IN_CIFP.txt), read when the user places it in Custom Data.
 *
 * X-Plane's CIFP (Laminar and Navigraph) codes a US "ILS OR LOC RWY 4R" as the ILS alone
 * (`I04R`); the FAA's own CIFP also codes its localizer procedure (`L04R`). The index lists
 * every procedure by airport, so an ILS whose identifier has an `L` twin there is charted as
 * ILS OR LOC. The app never ships or downloads this file; it is US only and the user keeps it
 * current.
 *
 * Format: tab-separated `airport ICAO`, `procedure type` (SIAP, SID, STAR), `procedure ident`,
 * with a header row and CRLF line ends.
 */

export type FaaProcedureIndex = ReadonlyMap<string, ReadonlySet<string>>;

/** The approach (SIAP) identifiers per airport; anything that is not an approach row is skipped. */
export function parseFaaProcedureIndex(text: string): FaaProcedureIndex {
  const index = new Map<string, Set<string>>();
  for (const line of text.split(/\r?\n/)) {
    const [airport, type, ident] = line.split('\t');
    if (type?.trim() !== 'SIAP' || !airport || !ident) continue;
    const icao = airport.trim().toUpperCase();
    let approaches = index.get(icao);
    if (!approaches) {
      approaches = new Set();
      index.set(icao, approaches);
    }
    approaches.add(ident.trim().toUpperCase());
  }
  return index;
}

/**
 * Whether an ILS approach is charted as ILS OR LOC: the FAA codes a localizer procedure for the
 * same runway and variant. The two identifiers differ only in their first letter (`I13-Z`,
 * `L13-Z`).
 */
export function chartedWithLocalizer(
  index: FaaProcedureIndex,
  icao: string,
  identifier: string
): boolean {
  const ident = identifier.trim().toUpperCase();
  if (!ident.startsWith('I')) return false;
  return index.get(icao.trim().toUpperCase())?.has(`L${ident.slice(1)}`) ?? false;
}

/** Marks each ILS approach at the airport that the index charts as ILS OR LOC. */
export function markIlsOrLoc(
  approaches: { name: string; orLocalizer?: boolean }[],
  index: FaaProcedureIndex,
  icao: string
): void {
  for (const approach of approaches) {
    if (chartedWithLocalizer(index, icao, approach.name)) approach.orLocalizer = true;
  }
}
