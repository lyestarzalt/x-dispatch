import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, DoorOpen, Plane, Rocket, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useNavDataCounts } from '@/queries/useNavDataQuery';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import type { Runway, StartupLocation } from '@/types/apt';
import { NamedPosition } from '@/types/geo';

type DepartureType = 'gates' | 'runways';

interface DepartureSelectorProps {
  onSelectGate: (gate: NamedPosition) => void;
  onSelectRunwayEnd: (runwayEnd: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
}

export default function DepartureSelector({
  onSelectGate,
  onSelectRunwayEnd,
  onSelectRunway,
}: DepartureSelectorProps) {
  const { t } = useTranslation();
  const [departureType, setDepartureType] = useState<DepartureType>('gates');
  const [searchQuery, setSearchQuery] = useState('');

  // Get state from stores
  const airport = useAppStore((s) => s.selectedAirportData);
  const selectedStartPosition = useAppStore((s) => s.startPosition);
  const airwaysMode = useMapStore((s) => s.navVisibility.airwaysMode);

  // Extract lat/lon from airport for nav data query
  const airportLat = useMemo(() => {
    if (!airport?.metadata?.datum_lat) return null;
    return parseFloat(airport.metadata.datum_lat);
  }, [airport?.metadata?.datum_lat]);

  const airportLon = useMemo(() => {
    if (!airport?.metadata?.datum_lon) return null;
    return parseFloat(airport.metadata.datum_lon);
  }, [airport?.metadata?.datum_lon]);

  // Get nav data counts (including ILS count)
  const navDataCounts = useNavDataCounts(airportLat, airportLon, airwaysMode);

  const runways = useMemo(() => airport?.runways ?? [], [airport?.runways]);
  const gates = useMemo(() => airport?.startupLocations ?? [], [airport?.startupLocations]);

  const filteredGates = useMemo(() => {
    if (!searchQuery) return gates;
    const q = searchQuery.toLowerCase();
    return gates.filter((g) => g.name.toLowerCase().includes(q));
  }, [gates, searchQuery]);

  const filteredRunways = useMemo(() => {
    if (!searchQuery) return runways;
    const q = searchQuery.toLowerCase();
    return runways.filter(
      (r) => r.ends[0].name.toLowerCase().includes(q) || r.ends[1].name.toLowerCase().includes(q)
    );
  }, [runways, searchQuery]);

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="xp-section-heading flex-1 border-0 pb-0">
          {t('sidebar.departurePosition')}
        </h3>
        {selectedStartPosition && (
          <Badge variant="success" className="px-1.5 py-0 text-xs">
            {selectedStartPosition.name}
          </Badge>
        )}
      </div>

      {/* Toggle between Gates and Runways */}
      <ToggleGroup
        type="single"
        value={departureType}
        onValueChange={(value) => {
          if (value) {
            setDepartureType(value as DepartureType);
            setSearchQuery('');
          }
        }}
        className="mb-2 w-full rounded-lg bg-secondary p-1"
      >
        <ToggleGroupItem
          value="gates"
          className="flex-1 gap-1 rounded-lg text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <DoorOpen className="h-3 w-3" />
          {t('sidebar.gates')}
          <span className="ml-1 text-xs opacity-70">({gates.length})</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="runways"
          className="flex-1 gap-1 rounded-lg text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Plane className="h-3 w-3 rotate-45" />
          {t('sidebar.runways')}
          <span className="ml-1 text-xs opacity-70">({runways.length})</span>
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Search input */}
      <div className="relative mb-2">
        <Input
          placeholder={t(
            departureType === 'gates' ? 'sidebar.searchGates' : 'sidebar.searchRunways'
          )}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 pr-7 text-xs"
        />
        <Search className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* List */}
      <ScrollArea className="h-52">
        {departureType === 'gates' ? (
          <GateList
            gates={filteredGates}
            allGates={gates}
            onSelect={onSelectGate}
            selectedIndex={
              selectedStartPosition?.type === 'ramp' ? selectedStartPosition.index : undefined
            }
          />
        ) : (
          <RunwayList
            runways={filteredRunways}
            allRunways={runways}
            onSelectEnd={onSelectRunwayEnd}
            onSelectRunway={onSelectRunway}
            selectedIndex={
              selectedStartPosition?.type === 'runway' ? selectedStartPosition.index : undefined
            }
            ilsCount={navDataCounts.ils}
          />
        )}
      </ScrollArea>
    </div>
  );
}

interface GateListProps {
  gates: StartupLocation[];
  allGates: StartupLocation[];
  onSelect: (gate: NamedPosition) => void;
  selectedIndex?: number;
}

function GateList({ gates, allGates, onSelect, selectedIndex }: GateListProps) {
  const { t } = useTranslation();

  // Pre-compute X-Plane indices: alphabetically sorted by name, then by latitude for duplicates
  // Must be before early return to satisfy React hooks rules
  const xplaneIndices = useMemo(() => {
    // Create sorted copy with original indices
    const sortedWithIndices = allGates
      .map((g, i) => ({ gate: g, originalIndex: i }))
      .sort((a, b) => {
        const nameCompare = a.gate.name.localeCompare(b.gate.name);
        if (nameCompare !== 0) return nameCompare;
        // For duplicate names, sort by latitude ascending
        return a.gate.latitude - b.gate.latitude;
      });

    // Build map from original index to sorted position (xplaneIndex)
    const indexMap = new Map<number, number>();
    sortedWithIndices.forEach((item, sortedIdx) => {
      indexMap.set(item.originalIndex, sortedIdx);
    });

    return allGates.map((_, i) => ({
      xplaneIndex: indexMap.get(i) ?? i,
    }));
  }, [allGates]);

  if (gates.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">{t('sidebar.noGatesFound')}</p>
    );
  }

  return (
    <div className="space-y-1 pr-2">
      {gates.map((gate) => {
        // Find the original index in the full gates array (for map selection state)
        const originalIndex = allGates.indexOf(gate);
        const isSelected = selectedIndex === originalIndex;
        // X-Plane index is position in alphabetically sorted list
        const xplaneIndex = xplaneIndices[originalIndex]?.xplaneIndex ?? originalIndex;
        return (
          <Button
            key={originalIndex}
            variant="ghost"
            onClick={() =>
              onSelect({
                latitude: gate.latitude,
                longitude: gate.longitude,
                name: gate.name,
                index: originalIndex,
                xplaneIndex,
              })
            }
            className={cn(
              'flex h-auto w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs',
              isSelected
                ? 'border border-primary bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-secondary text-muted-foreground hover:bg-accent'
            )}
          >
            <span className="flex items-center gap-2 truncate font-mono">
              {gate.name}
              {isSelected && <Rocket className="h-2.5 w-2.5" />}
            </span>
            <span className="text-xs text-muted-foreground/50">{Math.round(gate.heading)}°</span>
          </Button>
        );
      })}
    </div>
  );
}

interface RunwayListProps {
  runways: Runway[];
  allRunways: Runway[];
  onSelectEnd: (end: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedIndex?: number;
  ilsCount?: number;
}

function RunwayList({
  runways,
  allRunways,
  onSelectEnd,
  onSelectRunway,
  selectedIndex,
  ilsCount,
}: RunwayListProps) {
  const { t } = useTranslation();

  if (runways.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        {t('sidebar.noRunwaysFound')}
      </p>
    );
  }

  return (
    <div className="space-y-2 pr-2">
      {runways.map((runway) => {
        const runwayIndex = allRunways.indexOf(runway);
        return (
          <RunwayItem
            key={runwayIndex}
            runway={runway}
            runwayIndex={runwayIndex}
            onSelectEnd={onSelectEnd}
            onSelect={() => onSelectRunway?.(runway)}
            selectedIndex={selectedIndex}
            ilsCount={ilsCount}
          />
        );
      })}
    </div>
  );
}

interface RunwayItemProps {
  runway: Runway;
  runwayIndex: number;
  onSelect?: () => void;
  onSelectEnd: (end: NamedPosition) => void;
  selectedIndex?: number;
  ilsCount?: number;
}

function RunwayItem({
  runway,
  runwayIndex,
  onSelect,
  onSelectEnd,
  selectedIndex,
  ilsCount,
}: RunwayItemProps) {
  const { t } = useTranslation();
  const e1 = runway.ends[0];
  const e2 = runway.ends[1];

  // Calculate length using centralized geo utils
  const lengthFt = Math.round(runwayLengthFeet(e1, e2));

  const surfaceKeys: Record<number, string> = {
    1: 'asphalt',
    2: 'concrete',
    3: 'grass',
    4: 'dirt',
    5: 'gravel',
  };

  const hasLighting = e1.lighting > 0 || e2.lighting > 0;

  return (
    <div className="rounded-lg bg-secondary p-2.5">
      <Button
        variant="ghost"
        onClick={onSelect}
        className="h-auto w-full flex-col items-stretch gap-1 p-0 text-left hover:opacity-80"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">
              {e1.name}/{e2.name}
            </span>
            {ilsCount && ilsCount > 0 && (
              <Badge variant="success" className="px-1 py-0.5 text-xs">
                ILS
              </Badge>
            )}
            {hasLighting && (
              <Badge variant="warning" className="px-1 py-0.5 text-xs">
                LGT
              </Badge>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{lengthFt}'</span>
          <span>x</span>
          <span>{Math.round(metersToFeet(runway.width))}'</span>
          <span className="opacity-50">|</span>
          <span>{t(`airportInfo.surfaces.${surfaceKeys[runway.surface_type] || 'unknown'}`)}</span>
        </div>
      </Button>

      {/* Runway end selection */}
      <div className="mt-2 flex gap-2 border-t border-border/30 pt-2">
        <span className="self-center text-xs text-muted-foreground/50">
          {t('sidebar.startFrom')}
        </span>
        {[e1, e2].map((end, endIndex) => {
          // Calculate global runway end index: runwayIndex * 2 + endIndex
          const globalEndIndex = runwayIndex * 2 + endIndex;
          const isSelected = selectedIndex === globalEndIndex;
          return (
            <Button
              key={end.name}
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                // Calculate X-Plane index: "row_end" format
                const xplaneIndex = `${runwayIndex}_${endIndex}`;
                onSelectEnd({
                  name: end.name,
                  latitude: end.latitude,
                  longitude: end.longitude,
                  index: globalEndIndex,
                  xplaneIndex,
                });
              }}
              className={cn(
                'h-auto flex-1 rounded-lg px-2 py-1 font-mono text-xs font-medium',
                isSelected
                  ? 'border border-primary bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-accent text-muted-foreground hover:bg-muted'
              )}
            >
              {end.name}
              {isSelected && <Rocket className="ml-1 inline h-2.5 w-2.5" />}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
