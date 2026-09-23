/**
 * Runway ends straight from an airport's apt.dat block, without a full parse.
 * Row 100 is a land runway: the two end names sit at fixed token offsets.
 */
const LAND_RUNWAY_ROW = '100';
const END_ONE_NAME_INDEX = 8;
const END_TWO_NAME_INDEX = 17;
const RUNWAY_NAME_RE = /^\d{2}[LCRTW]?$/;

export function runwayEndsFromApt(aptText: string): string[] {
  const names = new Set<string>();
  for (const rawLine of aptText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith(`${LAND_RUNWAY_ROW} `)) continue;
    const tokens = line.split(/\s+/);
    for (const idx of [END_ONE_NAME_INDEX, END_TWO_NAME_INDEX]) {
      const name = tokens[idx];
      if (name && RUNWAY_NAME_RE.test(name)) names.add(name);
    }
  }
  return [...names].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
}
