import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { runwayMatches } from '@/lib/flightplan/builder/procedures';
import { formatApproachName } from '@/lib/parsers/nav/approachName';
import { chartTitleTags } from '@/lib/parsers/nav/faaChartIndex';
import { cn } from '@/lib/utils/helpers';
import { trackEvent, useAirportProcedures } from '@/queries';
import { useAppStore } from '@/stores/appStore';
import type { ResolvedProcedure as Procedure } from '@/types/navigation';
import { groupProcedures, variantSpread } from './route/procedureGroups';

type ProcedureType = 'SID' | 'STAR' | 'APP';

/**
 * The approach identifier spelled out; SIDs and STARs as they are. The raw code sits beside
 * the name except on a row that also carries a variant count, where it would not fit.
 */
function ProcedureName({
  proc,
  type,
  withCode = true,
}: {
  proc: Procedure;
  type: ProcedureType;
  withCode?: boolean;
}) {
  const { t } = useTranslation();
  if (type !== 'APP') {
    const tags = chartTitleTags(proc);
    if (tags.length === 0) return <span className="font-mono text-sm">{proc.name}</span>;
    return (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="font-mono text-sm">{proc.name}</span>
        <span className="text-muted-foreground/50 text-2xs truncate">
          {tags.map((tag) => t(`procedures.${tag}`)).join(' ')}
        </span>
      </span>
    );
  }
  const name = formatApproachName(
    proc.name,
    proc.approachType,
    proc.approachQualifier2,
    proc.orLocalizer,
    proc.helicopter
  );
  if (name === proc.name) return <span className="font-mono text-sm">{proc.name}</span>;
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="truncate text-sm">{name}</span>
      {withCode && <span className="text-muted-foreground/50 text-2xs font-mono">{proc.name}</span>}
    </span>
  );
}

export default function RouteTab() {
  const { t } = useTranslation();

  const icao = useAppStore((s) => s.selectedICAO);
  const selectedProcedure = useAppStore((s) => s.selectedProcedure);
  const selectProcedure = useAppStore((s) => s.selectProcedure);
  const startPosition = useAppStore((s) => s.startPosition);

  const { data: procedures, isLoading } = useAirportProcedures(icao);
  const [activeType, setActiveType] = useState<ProcedureType>('SID');
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null);
  const [onlyStartRunway, setOnlyStartRunway] = useState(true);

  // A runway picked as the start position narrows the list to procedures published for it.
  const startRunway =
    startPosition?.type === 'runway' && !startPosition.isHelipad && startPosition.airport === icao
      ? startPosition.name
      : undefined;
  const filterRunway = onlyStartRunway ? startRunway : undefined;

  const lists = useMemo(() => {
    const keep = (list: Procedure[]) =>
      filterRunway ? list.filter((p) => runwayMatches(p.runway, filterRunway)) : list;
    return {
      SID: keep(procedures?.sids ?? []),
      STAR: keep(procedures?.stars ?? []),
      APP: keep(procedures?.approaches ?? []),
    };
  }, [procedures, filterRunway]);

  // Procedures, not their runway and transition pairings.
  const counts = {
    SID: groupProcedures(lists.SID).length,
    STAR: groupProcedures(lists.STAR).length,
    APP: groupProcedures(lists.APP).length,
  };

  const grouped = useMemo(() => groupProcedures(lists[activeType]), [lists, activeType]);

  const handleSelect = (proc: Procedure) => {
    const isAlreadySelected =
      selectedProcedure?.name === proc.name &&
      selectedProcedure?.transition === proc.transition &&
      selectedProcedure?.runway === proc.runway;
    selectProcedure(isAlreadySelected ? null : proc);
    if (!isAlreadySelected) {
      trackEvent('procedure_selected', {
        type: activeType === 'SID' ? 'sid' : activeType === 'STAR' ? 'star' : 'app',
        source: 'manual',
      });
    }
  };

  const handleTypeChange = (value: string) => {
    setActiveType(value as ProcedureType);
    setExpandedProcedure(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="text-primary size-5" />
      </div>
    );
  }

  const hasAny =
    (procedures?.sids.length ?? 0) +
      (procedures?.stars.length ?? 0) +
      (procedures?.approaches.length ?? 0) >
    0;
  if (!procedures || !hasAny) {
    return (
      <p className="text-muted-foreground/60 py-12 text-center text-sm">{t('procedures.noData')}</p>
    );
  }

  return (
    <div>
      {/* Type toggle */}
      <Tabs value={activeType} onValueChange={handleTypeChange} className="mb-6">
        <TabsList variant="line" className="border-border/30 gap-4">
          {(['SID', 'STAR', 'APP'] as ProcedureType[]).map((type) => (
            <TabsTrigger key={type} value={type} className="px-0 text-sm">
              {type === 'APP' ? t('airportInfo.routeTab.tabApproach') : type}
              <span className="text-muted-foreground/50 ml-2">{counts[type]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {startRunway && (
        <label className="text-muted-foreground -mt-3 mb-4 flex items-center gap-2 text-xs">
          <Switch
            checked={onlyStartRunway}
            onCheckedChange={setOnlyStartRunway}
            className="scale-75"
            aria-label={t('airportInfo.routeTab.onlyRunway', { rwy: startRunway })}
          />
          {t('airportInfo.routeTab.onlyRunway', { rwy: startRunway })}
        </label>
      )}

      {/* Procedure list */}
      {grouped.length === 0 ? (
        <p className="text-muted-foreground/60 py-8 text-center text-sm">
          {activeType === 'APP'
            ? t('airportInfo.routeTab.noneApproaches')
            : t('airportInfo.routeTab.noneAvailable', { type: `${activeType}s` })}
        </p>
      ) : (
        <div className="space-y-1">
          {grouped.map((group) => {
            const isExpanded = expandedProcedure === group.name;
            const hasMultipleVariants = group.variants.length > 1;
            const isAnyVariantSelected = group.variants.some(
              (v) =>
                selectedProcedure?.name === v.name &&
                selectedProcedure?.transition === v.transition &&
                selectedProcedure?.runway === v.runway
            );

            // Single variant - direct selection
            if (!hasMultipleVariants) {
              const proc = group.variants[0];
              if (!proc) return null;
              const isSelected =
                selectedProcedure?.name === proc.name &&
                selectedProcedure?.transition === proc.transition &&
                selectedProcedure?.runway === proc.runway;

              // Show transition or runway as subtitle
              const subtitle = proc.transition
                ? proc.transition
                : proc.runway
                  ? t('simbriefDialog.header.runway', { rwy: proc.runway })
                  : null;

              return (
                <Button
                  key={group.name}
                  variant="ghost"
                  onClick={() => handleSelect(proc)}
                  className={cn(
                    'h-auto w-full justify-between px-3 py-2.5 text-left',
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80 hover:bg-muted/50'
                  )}
                >
                  <ProcedureName proc={proc} type={activeType} />
                  <div className="flex items-center gap-2">
                    {subtitle && (
                      <span className="text-muted-foreground/50 text-xs">{subtitle}</span>
                    )}
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </Button>
              );
            }

            // Multiple variants - expandable
            // Determine variant type based on what's actually in the data
            // - Approaches: transitions
            // - STARs: transitions (enroute entry points) or runways
            // - SIDs: runways or transitions (enroute exit points)
            // A procedure with both is one variant per pairing: count its transitions, and name
            // the runway on each row when there is more than one.
            const spread = variantSpread(group.variants);
            const showRunway = spread.transitions > 0 && spread.runways > 1;

            let variantLabel: string;
            if (spread.transitions > 0) {
              variantLabel = t('airportInfo.routeTab.transitionCount', {
                count: spread.transitions,
              });
            } else if (spread.runways > 0) {
              variantLabel = t('airportInfo.routeTab.runwayVariantCount', {
                count: spread.runways,
              });
            } else {
              variantLabel = t('airportInfo.routeTab.variantCount', {
                count: group.variants.length,
              });
            }

            return (
              <div key={group.name}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (isExpanded && isAnyVariantSelected) selectProcedure(null);
                    setExpandedProcedure(isExpanded ? null : group.name);
                  }}
                  className={cn(
                    'h-auto w-full justify-between px-3 py-2.5 text-left',
                    isAnyVariantSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80 hover:bg-muted/50'
                  )}
                >
                  <ProcedureName proc={group.variants[0]!} type={activeType} withCode={false} />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground/50 text-xs">{variantLabel}</span>
                    <ChevronRight
                      className={cn(
                        'text-muted-foreground h-4 w-4 transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </div>
                </Button>

                {/* Variants: transitions for approaches, runways for SID/STAR */}
                {isExpanded && (
                  <div className="border-border/30 mt-1 ml-4 space-y-1 border-l pl-3">
                    {group.variants.map((proc, idx) => {
                      const isSelected =
                        selectedProcedure?.name === proc.name &&
                        selectedProcedure?.transition === proc.transition &&
                        selectedProcedure?.runway === proc.runway;

                      // Display label - show transition if present, otherwise runway
                      let displayLabel: string;
                      if (proc.transition) {
                        displayLabel = proc.transition;
                      } else if (proc.runway) {
                        displayLabel = t('simbriefDialog.header.runway', { rwy: proc.runway });
                      } else {
                        displayLabel = t('airportInfo.routeTab.allVariants');
                      }

                      return (
                        <Button
                          key={`${proc.runway}-${proc.transition}-${idx}`}
                          variant="ghost"
                          onClick={() => handleSelect(proc)}
                          className={cn(
                            'h-auto w-full justify-between px-3 py-2 text-left',
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground/70 hover:bg-muted/50'
                          )}
                        >
                          <span className="text-sm">{displayLabel}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            {showRunway && proc.runway && (
                              <span className="text-muted-foreground/50 text-xs">
                                {t('simbriefDialog.header.runway', { rwy: proc.runway })}
                              </span>
                            )}
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
