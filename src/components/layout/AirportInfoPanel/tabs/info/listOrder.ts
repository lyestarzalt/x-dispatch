import type { Runway } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import type { MergedFreqRow } from './FrequencyRow';
import { runwayEndKey } from './runwayEndKey';

/** A localizer with no glideslope (earth_nav.dat row 5), as opposed to a full ILS (row 4). */
export function isLocalizerOnly(navaid: Navaid): boolean {
  return navaid.type === 'LOC';
}

/** Runways with an active end lead the list; the incoming order holds within each group. */
export function activeRunwaysFirst(runways: Runway[], activeEnds: ReadonlySet<string>): Runway[] {
  if (activeEnds.size === 0) return runways;
  const isActive = (runway: Runway) =>
    runway.ends.some((end) => activeEnds.has(runwayEndKey(end.name)));
  return [...runways.filter(isActive), ...runways.filter((runway) => !isActive(runway))];
}

// Staffed positions in the order a flight talks to them; anything else follows.
const LIVE_ORDER = ['ATIS', 'DEL', 'GND', 'TWR', 'DEP', 'APP', 'CTR'];

function liveRank(row: MergedFreqRow): number {
  const index = LIVE_ORDER.findIndex((label) => row.label.startsWith(label));
  return index === -1 ? LIVE_ORDER.length : index;
}

/** Staffed frequencies lead the list in flight order; unstaffed rows keep their order below. */
export function liveRowsFirst(rows: MergedFreqRow[]): MergedFreqRow[] {
  const live = rows.filter((row) => row.live);
  if (live.length === 0) return rows;
  live.sort((a, b) => liveRank(a) - liveRank(b));
  return [...live, ...rows.filter((row) => !row.live)];
}

/**
 * The runways with an active end, for the compact list; null when that would show none or
 * all of them, which leaves nothing to compact.
 */
export function compactRunways(
  runways: Runway[],
  activeEnds: ReadonlySet<string>
): Runway[] | null {
  const active = runways.filter((runway) =>
    runway.ends.some((end) => activeEnds.has(runwayEndKey(end.name)))
  );
  return active.length > 0 && active.length < runways.length ? active : null;
}

/** The staffed frequencies, for the compact list; null when none or all of them are. */
export function compactFreqRows(rows: MergedFreqRow[]): MergedFreqRow[] | null {
  const live = rows.filter((row) => row.live);
  return live.length > 0 && live.length < rows.length ? live : null;
}
