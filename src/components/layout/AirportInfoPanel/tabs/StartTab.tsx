import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plane, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import type { Helipad, Runway, StartupLocation } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import TaxiRouteInline from './TaxiRouteInline';

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

  // Auto-switch sub-tab and scroll to selected item when position changes
  const prevPositionRef = useRef<typeof selectedStartPosition>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedStartPosition || selectedStartPosition === prevPositionRef.current) return;
    prevPositionRef.current = selectedStartPosition;

    // Switch sub-tab based on position type
    if (selectedStartPosition.type === 'ramp') setViewType('gates');
    else if (selectedStartPosition.isHelipad) setViewType('helipads');
    else if (selectedStartPosition.type === 'runway') setViewType('runways');

    // Scroll to the selected item after sub-tab switch renders
    setTimeout(() => {
      const el = containerRef.current?.querySelector('[data-selected="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [selectedStartPosition]);

  // Clear search when switching tabs
  const handleTabChange = (value: string) => {
    setViewType(value as ViewType);
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
        <Tabs value={viewType} onValueChange={handleTabChange}>
          <TabsList variant="line" className="gap-3 border-border/30">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-0 text-sm">
                {t(tab.labelKey)}
                <span className="ml-1.5 text-muted-foreground/50">{tab.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Search input - only show for lists > 8 items */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t('airportInfo.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-border/50 bg-muted/30 pl-8 pr-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <div ref={containerRef}>
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
            selectedIndex={
              selectedStartPosition?.isHelipad ? selectedStartPosition.index : undefined
            }
          />
        )}
      </div>
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
type CatBadgeVariant =
  | 'secondary'
  | 'cat-sky'
  | 'cat-amber'
  | 'cat-red'
  | 'cat-emerald'
  | 'default';

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
          <div key={originalIndex}>
            <Button
              key={originalIndex}
              data-selected={isSelected || undefined}
              variant="ghost"
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
                'h-auto w-full flex-col items-stretch rounded px-2.5 py-2 text-left',
                isSelected
                  ? 'bg-cat-emerald/10 text-cat-emerald'
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
                    <Badge variant={sizeConfig.variant} className="h-4 px-1.5 text-[9px]">
                      {t(sizeConfig.labelKey)}
                    </Badge>
                  )}
                  {opConfig && (
                    <Badge variant={opConfig.variant} className="h-4 px-1.5 text-[9px]">
                      {t(opConfig.labelKey)}
                    </Badge>
                  )}
                </div>
              )}
            </Button>
            {/* Taxi route input — appears under the selected gate */}
            {isSelected && <TaxiRouteInline />}
          </div>
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

type RunwayStartMode = 'threshold' | 'approach' | 'tow';
const APPROACH_DISTANCES = [1, 2, 3, 5, 8, 10, 15, 20] as const;
const DEFAULT_APPROACH_DISTANCE = 3.5;

function getRunwayStartMode(
  startPosition: ReturnType<typeof useAppStore.getState>['startPosition']
): RunwayStartMode {
  if (startPosition?.approachDistanceNm != null) return 'approach';
  if (startPosition?.towType) return 'tow';
  return 'threshold';
}

function RunwayList({
  runways,
  searchQuery,
  onSelectEnd,
  onSelectRunway,
  selectedIndex,
}: RunwayListProps) {
  const { t } = useTranslation();
  const startPosition = useAppStore((s) => s.startPosition);
  const setStartPosition = useAppStore((s) => s.setStartPosition);

  const mode = getRunwayStartMode(startPosition);
  const approachDistance = startPosition?.approachDistanceNm ?? DEFAULT_APPROACH_DISTANCE;

  const setMode = (newMode: RunwayStartMode) => {
    if (!startPosition || startPosition.type !== 'runway' || startPosition.isHelipad) return;
    setStartPosition({
      ...startPosition,
      approachDistanceNm: newMode === 'approach' ? DEFAULT_APPROACH_DISTANCE : undefined,
      towType: newMode === 'tow' ? 'winch' : undefined,
    });
  };

  const setApproachDistance = (nm: number) => {
    if (!startPosition || startPosition.type !== 'runway') return;
    setStartPosition({ ...startPosition, approachDistanceNm: nm });
  };

  const setTowType = (towType: 'tug' | 'winch') => {
    if (!startPosition || startPosition.type !== 'runway') return;
    setStartPosition({ ...startPosition, towType });
  };

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

        // Check if either end of THIS runway is selected
        const end0Selected = selectedIndex === originalIndex * 2;
        const end1Selected = selectedIndex === originalIndex * 2 + 1;
        const thisRunwaySelected =
          (end0Selected || end1Selected) &&
          startPosition?.type === 'runway' &&
          !startPosition.isHelipad;

        return (
          <div key={originalIndex}>
            {/* Runway header */}
            <button
              onClick={() => onSelectRunway?.(runway)}
              className="mb-1.5 flex h-auto w-full items-baseline justify-between rounded px-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                  <Button
                    key={end.name}
                    data-selected={isSelected || undefined}
                    variant="ghost"
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
                      'h-auto flex-1 gap-1.5 rounded py-2 font-mono text-sm',
                      isSelected
                        ? 'bg-cat-emerald/10 text-cat-emerald'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    {end.name}
                    {isSelected && <Check className="h-3 w-3" />}
                  </Button>
                );
              })}
            </div>

            {/* Start options — inline under the selected runway */}
            {thisRunwaySelected && (
              <RunwayStartOptions
                mode={mode}
                approachDistance={approachDistance}
                towType={startPosition?.towType}
                onSetMode={setMode}
                onSetApproachDistance={setApproachDistance}
                onSetTowType={setTowType}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Inline start options panel shown under the selected runway */
function RunwayStartOptions({
  mode,
  approachDistance,
  towType,
  onSetMode,
  onSetApproachDistance,
  onSetTowType,
}: {
  mode: RunwayStartMode;
  approachDistance: number;
  towType?: 'tug' | 'winch';
  onSetMode: (mode: RunwayStartMode) => void;
  onSetApproachDistance: (nm: number) => void;
  onSetTowType: (type: 'tug' | 'winch') => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-2 space-y-2.5 rounded-lg border border-border/40 bg-muted/20 p-3">
      {/* Mode toggle: Threshold / Approach / Tow */}
      <div className="flex items-center gap-1">
        {(['threshold', 'approach', 'tow'] as const).map((m) => (
          <Button
            key={m}
            variant="ghost"
            size="sm"
            onClick={() => onSetMode(m)}
            className={cn(
              'h-7 flex-1 gap-1 text-xs',
              mode === m
                ? 'bg-cat-emerald/10 text-cat-emerald'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m === 'approach' && <Plane className="h-3 w-3 rotate-[-90deg]" />}
            {t(`airportInfo.runway.${m}`)}
          </Button>
        ))}
      </div>

      {/* Approach distance controls */}
      {mode === 'approach' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t('airportInfo.runway.distance')}
            </span>
            <span className="font-mono text-sm text-foreground">
              {approachDistance}
              <span className="ml-0.5 text-xs text-muted-foreground">nm</span>
            </span>
          </div>
          <Slider
            min={1}
            max={20}
            step={0.5}
            value={[approachDistance]}
            onValueChange={([v]) => {
              if (v !== undefined) onSetApproachDistance(v);
            }}
          />
          <div className="flex flex-wrap gap-1">
            {APPROACH_DISTANCES.map((d) => (
              <button
                key={d}
                onClick={() => onSetApproachDistance(d)}
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                  approachDistance === d
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tow controls */}
      {mode === 'tow' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetTowType('winch')}
              className={cn(
                'h-7 flex-1 text-xs',
                towType === 'winch'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('airportInfo.runway.winch')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetTowType('tug')}
              className={cn(
                'h-7 flex-1 text-xs',
                towType === 'tug'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('airportInfo.runway.tug')}
            </Button>
          </div>
          {towType === 'tug' && (
            <span className="text-xs text-muted-foreground">
              {t('airportInfo.runway.tugAircraft', 'Tow plane: Cessna 172 SP')}
            </span>
          )}
        </div>
      )}
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
          <Button
            key={originalIndex}
            data-selected={isSelected || undefined}
            variant="ghost"
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
              'h-auto w-full justify-between rounded px-2.5 py-2 text-left',
              isSelected
                ? 'bg-cat-emerald/10 text-cat-emerald'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
          >
            <span className="font-mono text-sm">{helipad.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">{sizeFt}</span>
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </div>
          </Button>
        );
      })}
    </div>
  );
}
