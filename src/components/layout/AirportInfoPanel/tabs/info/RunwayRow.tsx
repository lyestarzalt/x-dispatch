import { useUnits } from '@/hooks/useUnits';
import { runwayLengthFeet } from '@/lib/utils/geomath';
import type { Runway } from '@/types/apt';
import { SurfaceType } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import { RunwayEndCard } from './RunwayEndCard';
import { runwayEndKey } from './runwayEndKey';

const SURFACE_NAMES: Partial<Record<SurfaceType, string>> = {
  [SurfaceType.ASPHALT]: 'Asphalt',
  [SurfaceType.CONCRETE]: 'Concrete',
  [SurfaceType.TURF_OR_GRASS]: 'Grass',
  [SurfaceType.DIRT]: 'Dirt',
  [SurfaceType.GRAVEL]: 'Gravel',
  [SurfaceType.WATER_RUNWAY]: 'Water',
  [SurfaceType.SNOW_OR_ICE]: 'Snow',
};

/**
 * One runway as two end cards, kept together as a pair. Nearly everything the
 * panel shows belongs to an end (active, ILS, displaced threshold), so each
 * end gets its own card rather than sharing a "06/24" row.
 */
export function RunwayRow({
  runway,
  ilsByEnd,
  gsByEnd,
  activeEndNames,
}: {
  runway: Runway;
  ilsByEnd: Map<string, Navaid>;
  gsByEnd: Map<string, Navaid>;
  activeEndNames: Set<string>;
}) {
  const units = useUnits();
  const lengthDisplay = units.length(runwayLengthFeet(runway.ends[0], runway.ends[1]));
  // Use an em-dash for missing surface metadata so the row stays scannable
  // without drawing attention to "Unknown" data.
  const surface = SURFACE_NAMES[runway.surface_type] ?? '—';

  return (
    <li className="space-y-1">
      {([0, 1] as const).map((endIndex) => {
        const key = runwayEndKey(runway.ends[endIndex].name);
        return (
          <RunwayEndCard
            key={endIndex}
            runway={runway}
            endIndex={endIndex}
            lengthDisplay={lengthDisplay}
            surface={surface}
            ils={ilsByEnd.get(key)}
            gs={gsByEnd.get(key)}
            active={activeEndNames.has(key)}
          />
        );
      })}
    </li>
  );
}
