/**
 * What the airway database allows on one pair of fixes: the direction it may be flown and the
 * published level band. Shared by the resolver (checks a typed route) and the router (prefers
 * airways that fit the cruise level).
 */
import type { AirwaySegment } from '@/types/navigation';
import type { LevelBand } from './types';

/** Flight level to feet; a 0 top means the band is open at the top. */
const FL_TO_FT = 100;

/**
 * Whether the published level band covers the cruise level. Bands with no data count as
 * open. The router keeps this a penalty rather than a cut: a single out-of-band segment
 * would otherwise sever a continent-wide network.
 */
export function bandAllows(segment: AirwaySegment, cruiseFl: number): boolean {
  if (segment.baseFl === 0 && segment.topFl === 0) return true;
  if (segment.baseFl > cruiseFl) return false;
  return segment.topFl === 0 || segment.topFl >= cruiseFl;
}

/** Whether a segment may be flown from `from` to `to`. 0 is both ways, 1 as stored, 2 reversed. */
export function segmentAllowsDirection(segment: AirwaySegment, from: string, to: string): boolean {
  if (!segment.direction) return true;
  const stored = segment.fromFix === from && segment.toFix === to;
  return segment.direction === 1 ? stored : !stored;
}

/** The segments stored for a pair of fixes, either way round. */
export function segmentsForPair(segments: AirwaySegment[], a: string, b: string): AirwaySegment[] {
  return segments.filter(
    (s) => (s.fromFix === a && s.toFix === b) || (s.fromFix === b && s.toFix === a)
  );
}

/** The most permissive band across the segments stored for one pair, in feet. */
export function pairBand(segments: AirwaySegment[]): LevelBand {
  let minFt: number | null = null;
  let maxFt: number | null = null;
  let open = false;
  for (const s of segments) {
    if (s.baseFl === 0 && s.topFl === 0) return { minFt: null, maxFt: null };
    const base = s.baseFl * FL_TO_FT;
    minFt = minFt === null ? base : Math.min(minFt, base);
    if (s.topFl === 0) open = true;
    else {
      const top = s.topFl * FL_TO_FT;
      maxFt = maxFt === null ? top : Math.max(maxFt, top);
    }
  }
  return { minFt, maxFt: open ? null : maxFt };
}

/** Narrows a route band by one more pair: the highest floor and the lowest ceiling win. */
export function narrowBand(route: LevelBand, pair: LevelBand): LevelBand {
  return {
    minFt: pair.minFt === null ? route.minFt : Math.max(route.minFt ?? -Infinity, pair.minFt),
    maxFt: pair.maxFt === null ? route.maxFt : Math.min(route.maxFt ?? Infinity, pair.maxFt),
  };
}
