import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight } from 'lucide-react';
import type { Procedure } from '@/lib/parsers/nav/cifpParser';
import { cn } from '@/lib/utils/helpers';
import { useAirportProcedures } from '@/queries';
import { useAppStore } from '@/stores/appStore';

type ProcedureType = 'SID' | 'STAR' | 'APP';

interface GroupedProcedure {
  name: string;
  variants: Procedure[];
}

function groupProcedures(procedures: Procedure[]): GroupedProcedure[] {
  const groups = new Map<string, Procedure[]>();

  for (const proc of procedures) {
    const existing = groups.get(proc.name) || [];
    groups.set(proc.name, [...existing, proc]);
  }

  return Array.from(groups.entries()).map(([name, variants]) => ({
    name,
    variants,
  }));
}

export default function RouteTab() {
  const { t } = useTranslation();

  const icao = useAppStore((s) => s.selectedICAO);
  const selectedProcedure = useAppStore((s) => s.selectedProcedure);
  const selectProcedure = useAppStore((s) => s.selectProcedure);

  const { data: procedures, isLoading } = useAirportProcedures(icao);
  const [activeType, setActiveType] = useState<ProcedureType>('SID');
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null);

  const counts = {
    SID: procedures?.sids.length || 0,
    STAR: procedures?.stars.length || 0,
    APP: procedures?.approaches.length || 0,
  };

  const grouped = useMemo(() => {
    if (!procedures) return [];
    switch (activeType) {
      case 'SID':
        return groupProcedures(procedures.sids);
      case 'STAR':
        return groupProcedures(procedures.stars);
      case 'APP':
        return groupProcedures(procedures.approaches);
    }
  }, [procedures, activeType]);

  const handleSelect = (proc: Procedure) => {
    selectProcedure(proc as Parameters<typeof selectProcedure>[0]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!procedures || (counts.SID === 0 && counts.STAR === 0 && counts.APP === 0)) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground/60">{t('procedures.noData')}</p>
    );
  }

  return (
    <div>
      {/* Type toggle */}
      <div className="mb-6 flex gap-4 border-b border-border/30">
        {(['SID', 'STAR', 'APP'] as ProcedureType[]).map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveType(type);
              setExpandedProcedure(null);
            }}
            className={cn(
              '-mb-px pb-3 text-sm font-medium transition-colors',
              activeType === type
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {type === 'APP' ? 'Approach' : type}
            <span className="ml-2 text-muted-foreground/50">{counts[type]}</span>
          </button>
        ))}
      </div>

      {/* Procedure list */}
      {grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          No {activeType === 'APP' ? 'approaches' : `${activeType}s`} available
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
              const isSelected =
                selectedProcedure?.name === proc.name &&
                selectedProcedure?.transition === proc.transition &&
                selectedProcedure?.runway === proc.runway;

              // Show transition or runway as subtitle
              const subtitle = proc.transition
                ? proc.transition
                : proc.runway
                  ? `RWY ${proc.runway}`
                  : null;

              return (
                <button
                  key={group.name}
                  onClick={() => handleSelect(proc)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80 hover:bg-muted/50'
                  )}
                >
                  <span className="font-mono text-sm">{proc.name}</span>
                  <div className="flex items-center gap-2">
                    {subtitle && (
                      <span className="text-xs text-muted-foreground/50">{subtitle}</span>
                    )}
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </button>
              );
            }

            // Multiple variants - expandable
            // Determine variant type based on what's actually in the data
            // - Approaches: transitions
            // - STARs: transitions (enroute entry points) or runways
            // - SIDs: runways or transitions (enroute exit points)
            const hasTransitions = group.variants.some((v) => v.transition);
            const hasRunways = group.variants.some((v) => v.runway);

            let variantLabel: string;
            if (hasTransitions && !hasRunways) {
              variantLabel = `${group.variants.length} transition${group.variants.length > 1 ? 's' : ''}`;
            } else if (hasRunways && !hasTransitions) {
              variantLabel = `${group.variants.length} runway${group.variants.length > 1 ? 's' : ''}`;
            } else {
              variantLabel = `${group.variants.length} variant${group.variants.length > 1 ? 's' : ''}`;
            }

            return (
              <div key={group.name}>
                <button
                  onClick={() => setExpandedProcedure(isExpanded ? null : group.name)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
                    isAnyVariantSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{group.name}</span>
                    <span className="text-xs text-muted-foreground/50">{variantLabel}</span>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>

                {/* Variants: transitions for approaches, runways for SID/STAR */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-border/30 pl-3">
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
                        displayLabel = `RWY ${proc.runway}`;
                      } else {
                        displayLabel = 'All';
                      }

                      return (
                        <button
                          key={`${proc.runway}-${proc.transition}-${idx}`}
                          onClick={() => handleSelect(proc)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground/70 hover:bg-muted/50'
                          )}
                        >
                          <span className="text-sm">{displayLabel}</span>
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </button>
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
