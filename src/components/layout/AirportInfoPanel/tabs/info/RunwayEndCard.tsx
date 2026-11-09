import { useTranslation } from 'react-i18next';
import { ChevronDown, PlaneLanding } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnits } from '@/hooks/useUnits';
import { metersToFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { Runway } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import { IlsDetail } from './IlsDetail';
import { landingDistanceFeet } from './runwayDistances';

/**
 * One runway end: its ILS, its landing distance when the threshold is
 * displaced, and the active tint. The pair's shared facts (length, surface)
 * repeat on both cards so each reads on its own.
 */
export function RunwayEndCard({
  runway,
  endIndex,
  lengthDisplay,
  surface,
  ils,
  gs,
  active,
}: {
  runway: Runway;
  endIndex: 0 | 1;
  lengthDisplay: string;
  surface: string;
  ils?: Navaid;
  gs?: Navaid;
  active: boolean;
}) {
  const { t } = useTranslation();
  const units = useUnits();
  const end = runway.ends[endIndex];
  const displaced = end.dthr_length > 0;

  return (
    <div
      className={cn(
        'rounded px-2.5 py-1.5',
        active ? 'bg-cat-emerald/10 ring-cat-emerald/30 ring-1' : 'bg-muted/20'
      )}
    >
      <Collapsible>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Fixed column: "9" and "27L" differ in width, the ILS chips must not drift. */}
            <span
              className={cn(
                'inline-block w-9 shrink-0 font-mono text-sm font-semibold',
                active ? 'text-cat-emerald' : 'text-foreground'
              )}
            >
              {end.name}
            </span>
            {ils && (
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
        {displaced && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-warning mt-0.5 flex items-center justify-end gap-1 text-xs">
                <PlaneLanding className="h-3 w-3" aria-hidden />
                <span className="font-mono tabular-nums">
                  {t('airportInfo.displacedThreshold.lda', {
                    length: units.length(landingDistanceFeet(runway, endIndex)),
                  })}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {t('airportInfo.displacedThreshold.tooltip', {
                displaced: units.length(metersToFeet(end.dthr_length)),
                lda: units.length(landingDistanceFeet(runway, endIndex)),
              })}
            </TooltipContent>
          </Tooltip>
        )}
        {ils && (
          <CollapsibleContent>
            <div className="border-border/40 mt-2 border-t pt-2">
              <IlsDetail endName={end.name} ils={ils} gs={gs} hideName />
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}
