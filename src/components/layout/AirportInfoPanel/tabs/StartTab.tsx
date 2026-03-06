import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import type { Helipad, Runway, StartupLocation } from '@/types/apt';
import { NamedPosition } from '@/types/geo';

type ViewType = 'gates' | 'runways' | 'helipads';

interface StartTabProps {
  onSelectGate?: (gate: NamedPosition) => void;
  onSelectRunwayEnd?: (runwayEnd: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  onSelectHelipad?: (helipad: NamedPosition) => void;
}

export default function StartTab({
  onSelectGate,
  onSelectRunwayEnd,
  onSelectRunway,
  onSelectHelipad,
}: StartTabProps) {
  const { t } = useTranslation();

  const airport = useAppStore((s) => s.selectedAirportData);
  const selectedStartPosition = useAppStore((s) => s.startPosition);

  const runways = useMemo(() => airport?.runways ?? [], [airport?.runways]);
  const gates = useMemo(() => airport?.startupLocations ?? [], [airport?.startupLocations]);
  const helipads = useMemo(() => airport?.helipads ?? [], [airport?.helipads]);

  // Default to first non-empty category
  const defaultView = gates.length > 0 ? 'gates' : runways.length > 0 ? 'runways' : 'helipads';
  const [viewType, setViewType] = useState<ViewType>(defaultView);
  const [searchQuery, setSearchQuery] = useState('');

  // Clear search when switching tabs
  const handleTabChange = (tab: ViewType) => {
    setViewType(tab);
    setSearchQuery('');
  };

  // Only show tabs that have data
  const tabs = [
    { id: 'gates' as const, labelKey: 'airportInfo.tabs.gates', count: gates.length },
    { id: 'runways' as const, labelKey: 'airportInfo.tabs.runways', count: runways.length },
    { id: 'helipads' as const, labelKey: 'airportInfo.tabs.helipads', count: helipads.length },
  ].filter((tab) => tab.count > 0);

  // Current list count for showing search
  const currentCount =
    viewType === 'gates' ? gates.length : viewType === 'runways' ? runways.length : helipads.length;
  const showSearch = currentCount > 8;

  if (tabs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground/60">
        {t('airportInfo.noStartPositions')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle - only show if multiple categories */}
      {tabs.length > 1 && (
        <div className="flex gap-3 border-b border-border/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                '-mb-px pb-2 text-sm font-medium transition-colors',
                viewType === tab.id
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t(tab.labelKey)}
              <span className="ml-1.5 text-muted-foreground/50">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search input - only show for lists > 8 items */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('airportInfo.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-border/50 bg-muted/30 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {viewType === 'gates' && (
        <GateList
          gates={gates}
          searchQuery={searchQuery}
          onSelect={onSelectGate}
          selectedIndex={
            selectedStartPosition?.type === 'ramp' ? selectedStartPosition.index : undefined
          }
        />
      )}
      {viewType === 'runways' && (
        <RunwayList
          runways={runways}
          searchQuery={searchQuery}
          onSelectEnd={onSelectRunwayEnd}
          onSelectRunway={onSelectRunway}
          selectedIndex={
            selectedStartPosition?.type === 'runway' ? selectedStartPosition.index : undefined
          }
        />
      )}
      {viewType === 'helipads' && (
        <HelipadList
          helipads={helipads}
          searchQuery={searchQuery}
          runwayCount={runways.length}
          onSelect={onSelectHelipad}
          selectedIndex={selectedStartPosition?.isHelipad ? selectedStartPosition.index : undefined}
        />
      )}
    </div>
  );
}

interface GateListProps {
  gates: StartupLocation[];
  searchQuery: string;
  onSelect?: (gate: NamedPosition) => void;
  selectedIndex?: number;
}

// Human-readable aircraft size from ICAO width code
const SIZE_LABELS: Record<string, { labelKey: string; class: string }> = {
  A: { labelKey: 'airportInfo.sizes.small', class: 'bg-muted/50 text-muted-foreground' },
  B: { labelKey: 'airportInfo.sizes.small', class: 'bg-muted/50 text-muted-foreground' },
  C: { labelKey: 'airportInfo.sizes.narrow', class: 'bg-cat-sky/15 text-cat-sky' },
  D: { labelKey: 'airportInfo.sizes.wide', class: 'bg-cat-sky/15 text-cat-sky' },
  E: { labelKey: 'airportInfo.sizes.heavy', class: 'bg-cat-amber/15 text-cat-amber' },
  F: { labelKey: 'airportInfo.sizes.super', class: 'bg-cat-red/15 text-cat-red' },
};

// Operation type badges
const OP_TYPE_LABELS: Record<string, { labelKey: string; class: string }> = {
  airline: { labelKey: 'airportInfo.opTypes.airline', class: 'bg-primary/15 text-primary' },
  cargo: { labelKey: 'airportInfo.opTypes.cargo', class: 'bg-cat-amber/15 text-cat-amber' },
  general_aviation: {
    labelKey: 'airportInfo.opTypes.ga',
    class: 'bg-cat-emerald/15 text-cat-emerald',
  },
  military: { labelKey: 'airportInfo.opTypes.military', class: 'bg-cat-red/15 text-cat-red' },
};

function GateList({ gates, searchQuery, onSelect, selectedIndex }: GateListProps) {
  const { t } = useTranslation();

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
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        {t('sidebar.noGatesFound')}
      </p>
    );
  }

  if (filteredGates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/60">
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
          <button
            key={originalIndex}
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
            className={cn(
              'flex w-full flex-col rounded px-2.5 py-2 text-left transition-colors',
              isSelected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
          >
            {/* Row 1: Name + Heading */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{gate.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50">
                  {Math.round(gate.heading)}°
                </span>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </div>
            </div>
            {/* Row 2: Badges */}
            {hasBadges && (
              <div className="mt-1 flex gap-1.5">
                {sizeConfig && (
                  <Badge
                    variant="secondary"
                    className={cn('h-4 px-1.5 text-[9px]', sizeConfig.class)}
                  >
                    {t(sizeConfig.labelKey)}
                  </Badge>
                )}
                {opConfig && (
                  <Badge
                    variant="secondary"
                    className={cn('h-4 px-1.5 text-[9px]', opConfig.class)}
                  >
                    {t(opConfig.labelKey)}
                  </Badge>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface RunwayListProps {
  runways: Runway[];
  searchQuery: string;
  onSelectEnd?: (end: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedIndex?: number;
}

function RunwayList({
  runways,
  searchQuery,
  onSelectEnd,
  onSelectRunway,
  selectedIndex,
}: RunwayListProps) {
  const { t } = useTranslation();

  // Filter runways by search (match either end name)
  const filteredRunways = useMemo(() => {
    if (!searchQuery.trim()) return runways.map((r, i) => ({ runway: r, originalIndex: i }));
    const query = searchQuery.toLowerCase();
    return runways
      .map((r, i) => ({ runway: r, originalIndex: i }))
      .filter(
        (item) =>
          item.runway.ends[0].name.toLowerCase().includes(query) ||
          item.runway.ends[1].name.toLowerCase().includes(query)
      );
  }, [runways, searchQuery]);

  if (runways.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        {t('sidebar.noRunwaysFound')}
      </p>
    );
  }

  if (filteredRunways.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        No runways matching "{searchQuery}"
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {filteredRunways.map(({ runway, originalIndex }) => {
        const e1 = runway.ends[0];
        const e2 = runway.ends[1];
        const lengthFt = Math.round(runwayLengthFeet(e1, e2));
        const widthFt = Math.round(metersToFeet(runway.width));

        return (
          <div key={originalIndex}>
            {/* Runway header */}
            <button
              onClick={() => onSelectRunway?.(runway)}
              className="mb-1.5 flex w-full items-baseline justify-between text-left"
            >
              <span className="font-mono text-sm font-semibold text-foreground">
                {e1.name}/{e2.name}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {lengthFt.toLocaleString()}'×{widthFt}'
              </span>
            </button>

            {/* Runway ends */}
            <div className="flex gap-1.5">
              {[e1, e2].map((end, endIndex) => {
                const globalEndIndex = originalIndex * 2 + endIndex;
                const isSelected = selectedIndex === globalEndIndex;

                return (
                  <button
                    key={end.name}
                    onClick={() =>
                      onSelectEnd?.({
                        name: end.name,
                        latitude: end.latitude,
                        longitude: end.longitude,
                        index: globalEndIndex,
                        xplaneIndex: `${originalIndex}_${endIndex}`,
                      })
                    }
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded py-2 font-mono text-sm transition-colors',
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    {end.name}
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HelipadListProps {
  helipads: Helipad[];
  searchQuery: string;
  runwayCount: number;
  onSelect?: (helipad: NamedPosition) => void;
  selectedIndex?: number;
}

function HelipadList({
  helipads,
  searchQuery,
  runwayCount,
  onSelect,
  selectedIndex,
}: HelipadListProps) {
  // Filter helipads by search
  const filteredHelipads = useMemo(() => {
    if (!searchQuery.trim()) return helipads.map((h, i) => ({ helipad: h, originalIndex: i }));
    const query = searchQuery.toLowerCase();
    return helipads
      .map((h, i) => ({ helipad: h, originalIndex: i }))
      .filter((item) => item.helipad.name.toLowerCase().includes(query));
  }, [helipads, searchQuery]);

  if (helipads.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground/60">No helipads found</p>;
  }

  if (filteredHelipads.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        No helipads matching "{searchQuery}"
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {filteredHelipads.map(({ helipad, originalIndex }) => {
        const isSelected = selectedIndex === originalIndex;
        const sizeFt = `${Math.round(metersToFeet(helipad.length))}'×${Math.round(metersToFeet(helipad.width))}'`;
        const xplaneIndex = `${runwayCount + originalIndex}_0`;

        return (
          <button
            key={originalIndex}
            onClick={() =>
              onSelect?.({
                latitude: helipad.latitude,
                longitude: helipad.longitude,
                name: helipad.name,
                heading: helipad.heading,
                index: originalIndex,
                xplaneIndex,
              })
            }
            className={cn(
              'flex w-full items-center justify-between rounded px-2.5 py-2 text-left transition-colors',
              isSelected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
          >
            <span className="font-mono text-sm">{helipad.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">{sizeFt}</span>
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
