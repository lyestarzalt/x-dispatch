import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUnits } from '@/hooks/useUnits';
import { type Degrees } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { StartupLocation } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import TaxiRouteInline from '../TaxiRouteInline';

interface GateListProps {
  gates: StartupLocation[];
  searchQuery: string;
  onSelect?: (gate: NamedPosition) => void;
  selectedIndex?: number;
}

// Human-readable aircraft size from ICAO width code
type CatBadgeVariant =
  'secondary' | 'cat-sky' | 'cat-amber' | 'cat-red' | 'cat-emerald' | 'default';

const SIZE_LABELS: Record<string, { labelKey: string; variant: CatBadgeVariant }> = {
  A: { labelKey: 'airportInfo.sizes.small', variant: 'secondary' },
  B: { labelKey: 'airportInfo.sizes.small', variant: 'secondary' },
  C: { labelKey: 'airportInfo.sizes.narrow', variant: 'cat-sky' },
  D: { labelKey: 'airportInfo.sizes.wide', variant: 'cat-sky' },
  E: { labelKey: 'airportInfo.sizes.heavy', variant: 'cat-amber' },
  F: { labelKey: 'airportInfo.sizes.super', variant: 'cat-red' },
};

// Operation type badges
const OP_TYPE_LABELS: Record<string, { labelKey: string; variant: CatBadgeVariant }> = {
  airline: { labelKey: 'airportInfo.opTypes.airline', variant: 'default' },
  cargo: { labelKey: 'airportInfo.opTypes.cargo', variant: 'cat-amber' },
  general_aviation: { labelKey: 'airportInfo.opTypes.ga', variant: 'cat-emerald' },
  military: { labelKey: 'airportInfo.opTypes.military', variant: 'cat-red' },
};

export function GateList({ gates, searchQuery, onSelect, selectedIndex }: GateListProps) {
  const { t } = useTranslation();
  const units = useUnits();

  const xplaneIndices = useMemo(() => {
    const sortedWithIndices = gates
      .map((g, i) => ({ gate: g, originalIndex: i }))
      .sort((a, b) => {
        const nameCompare = a.gate.name.localeCompare(b.gate.name);
        if (nameCompare !== 0) return nameCompare;
        return a.gate.latitude - b.gate.latitude;
      });

    const indexMap = new Map<number, number>();
    sortedWithIndices.forEach((item, sortedIdx) => {
      indexMap.set(item.originalIndex, sortedIdx);
    });

    return gates.map((_, i) => indexMap.get(i) ?? i);
  }, [gates]);

  // Filter gates by search (also search by operation type, size, and airlines)
  const filteredGates = useMemo(() => {
    if (!searchQuery.trim()) return gates.map((g, i) => ({ gate: g, originalIndex: i }));
    const query = searchQuery.toLowerCase();
    return gates
      .map((g, i) => ({ gate: g, originalIndex: i }))
      .filter((item) => {
        const gate = item.gate;
        const sizeLabelKey = gate.icaoWidthCode ? SIZE_LABELS[gate.icaoWidthCode]?.labelKey : '';
        const opLabelKey = gate.operationType ? OP_TYPE_LABELS[gate.operationType]?.labelKey : '';
        const sizeLabel = sizeLabelKey ? t(sizeLabelKey) : '';
        const opLabel = opLabelKey ? t(opLabelKey) : '';
        return (
          gate.name.toLowerCase().includes(query) ||
          sizeLabel.toLowerCase().includes(query) ||
          opLabel.toLowerCase().includes(query) ||
          gate.airlines?.some((a) => a.toLowerCase().includes(query))
        );
      });
  }, [gates, searchQuery, t]);

  if (gates.length === 0) {
    return (
      <p className="text-muted-foreground/60 py-8 text-center text-sm">
        {t('sidebar.noGatesFound')}
      </p>
    );
  }

  if (filteredGates.length === 0) {
    return (
      <p className="text-muted-foreground/60 py-8 text-center text-sm">
        {t('airportInfo.noMatchingGates', { query: searchQuery })}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {filteredGates.map(({ gate, originalIndex }) => {
        const isSelected = selectedIndex === originalIndex;
        const sizeConfig = gate.icaoWidthCode ? SIZE_LABELS[gate.icaoWidthCode] : null;
        const opConfig = gate.operationType ? OP_TYPE_LABELS[gate.operationType] : null;
        const hasBadges = sizeConfig || opConfig;

        return (
          <div
            key={originalIndex}
            data-testid="gate-row"
            data-selected={isSelected || undefined}
            className={cn(
              'rounded px-2.5 py-2',
              isSelected
                ? 'bg-cat-emerald/10 text-cat-emerald'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
            onClick={() =>
              onSelect?.({
                latitude: gate.latitude,
                longitude: gate.longitude,
                name: gate.name,
                heading: gate.heading,
                index: originalIndex,
                xplaneIndex: xplaneIndices[originalIndex],
              })
            }
          >
            {/* Row 1: Name + Heading */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{gate.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/50 text-2xs">
                  {units.course(gate.heading as Degrees, gate.latitude, gate.longitude)}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </div>
            </div>
            {/* Row 2: Badges */}
            {hasBadges && (
              <div className="mt-1 flex gap-1.5">
                {sizeConfig && (
                  <Badge variant={sizeConfig.variant} className="text-2xs h-4 px-1.5">
                    {t(sizeConfig.labelKey)}
                  </Badge>
                )}
                {opConfig && (
                  <Badge variant={opConfig.variant} className="text-2xs h-4 px-1.5">
                    {t(opConfig.labelKey)}
                  </Badge>
                )}
              </div>
            )}
            {/* Taxi route — inside the card */}
            {isSelected && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <TaxiRouteInline />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
