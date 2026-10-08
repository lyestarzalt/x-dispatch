import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUnits } from '@/hooks/useUnits';
import { runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { Runway } from '@/types/apt';
import { SurfaceType } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import { IlsDetail } from './IlsDetail';

// ---------------------------------------------------------------------------
// Constants — design system tokens only (cat-* category colors, xp-* utility
// classes from index.css, standard shadcn surface tokens).
// ---------------------------------------------------------------------------

const SURFACE_NAMES: Partial<Record<SurfaceType, string>> = {
  [SurfaceType.ASPHALT]: 'Asphalt',
  [SurfaceType.CONCRETE]: 'Concrete',
  [SurfaceType.TURF_OR_GRASS]: 'Grass',
  [SurfaceType.DIRT]: 'Dirt',
  [SurfaceType.GRAVEL]: 'Gravel',
  [SurfaceType.WATER_RUNWAY]: 'Water',
  [SurfaceType.SNOW_OR_ICE]: 'Snow',
};

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
  const lengthDisplay = units.altitude(runwayLengthFeet(runway.ends[0], runway.ends[1]));
  // Use an em-dash for missing surface metadata so the row stays scannable
  // without drawing attention to "Unknown" data.
  const surface = SURFACE_NAMES[runway.surface_type] ?? '—';
  const ils0 = ilsByEnd.get(runway.ends[0].name.toUpperCase());
  const ils1 = ilsByEnd.get(runway.ends[1].name.toUpperCase());
  const hasIls = Boolean(ils0 || ils1);
  const isActive =
    activeEndNames.has(runway.ends[0].name.toUpperCase()) ||
    activeEndNames.has(runway.ends[1].name.toUpperCase());

  // Stable per-end list for the expanded detail card. Filters out ends that
  // don't actually have an ILS (e.g. only 27 has one on a 09/27 pair). GS is
  // optional — comes from a separate Navaid record, may be absent on a few
  // older procedures.
  const ilsEnds: Array<{ endName: string; ils: Navaid; gs?: Navaid }> = [];
  if (ils0) {
    ilsEnds.push({
      endName: runway.ends[0].name,
      ils: ils0,
      gs: gsByEnd.get(runway.ends[0].name.toUpperCase()),
    });
  }
  if (ils1) {
    ilsEnds.push({
      endName: runway.ends[1].name,
      ils: ils1,
      gs: gsByEnd.get(runway.ends[1].name.toUpperCase()),
    });
  }

  return (
    <li
      className={cn(
        'rounded px-2.5 py-1.5',
        isActive ? 'bg-cat-emerald/10 ring-cat-emerald/30 ring-1' : 'bg-muted/20'
      )}
    >
      <Collapsible>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-mono text-sm font-semibold',
                isActive ? 'text-cat-emerald' : 'text-foreground'
              )}
            >
              {runway.ends[0].name}/{runway.ends[1].name}
            </span>
            {hasIls && (
              <CollapsibleTrigger asChild>
                <Badge
                  variant="info"
                  className="group hover:bg-info/30 gap-1 px-1.5 py-0 font-mono uppercase"
                >
                  <ChevronDown className="h-3 w-3 transition-transform duration-150 group-data-[state=open]:rotate-180" />
                  ILS
                </Badge>
              </CollapsibleTrigger>
            )}
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="font-mono tabular-nums">{lengthDisplay}</span>
            <span className="text-muted-foreground/70">{surface}</span>
          </div>
        </div>
        {hasIls && (
          <CollapsibleContent>
            <div className="border-border/40 mt-2 space-y-2 border-t pt-2">
              {ilsEnds.map(({ endName, ils, gs }) => (
                <IlsDetail key={endName} endName={endName} ils={ils} gs={gs} />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  );
}
