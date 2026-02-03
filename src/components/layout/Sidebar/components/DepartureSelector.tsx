import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, DoorOpen, Plane, Rocket, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Runway, StartupLocation } from '@/lib/aptParser/types';
import { metersToFeet, runwayLengthFeet } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { NamedPosition } from '@/types/geo';

type DepartureType = 'gates' | 'runways';

interface DepartureSelectorProps {
  runways: Runway[];
  gates: StartupLocation[];
  onSelectGate: (gate: NamedPosition) => void;
  onSelectRunwayEnd: (runwayEnd: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedStartPosition?: { type: 'runway' | 'ramp'; name: string } | null;
  ilsCount?: number;
}

export default function DepartureSelector({
  runways,
  gates,
  onSelectGate,
  onSelectRunwayEnd,
  onSelectRunway,
  selectedStartPosition,
  ilsCount,
}: DepartureSelectorProps) {
  const { t } = useTranslation();
  const [departureType, setDepartureType] = useState<DepartureType>('gates');
  const [searchQuery, setSearchQuery] = useState('');

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
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
        className="mb-2 w-full rounded-lg bg-muted/50 p-1"
      >
        <ToggleGroupItem
          value="gates"
          className="flex-1 gap-1 rounded text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          <DoorOpen className="h-3 w-3" />
          {t('sidebar.gates')}
          <span className="ml-1 text-xs text-muted-foreground">({gates.length})</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="runways"
          className="flex-1 gap-1 rounded text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          <Plane className="h-3 w-3 rotate-45" />
          {t('sidebar.runways')}
          <span className="ml-1 text-xs text-muted-foreground">({runways.length})</span>
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Search input */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          placeholder={t(
            departureType === 'gates' ? 'sidebar.searchGates' : 'sidebar.searchRunways'
          )}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 border-border bg-muted/50 pl-7 text-xs"
        />
      </div>

      {/* List */}
      <ScrollArea className="h-52">
        {departureType === 'gates' ? (
          <GateList
            gates={filteredGates}
            onSelect={onSelectGate}
            selectedName={
              selectedStartPosition?.type === 'ramp' ? selectedStartPosition.name : undefined
            }
          />
        ) : (
          <RunwayList
            runways={filteredRunways}
            onSelectEnd={onSelectRunwayEnd}
            onSelectRunway={onSelectRunway}
            selectedName={
              selectedStartPosition?.type === 'runway' ? selectedStartPosition.name : undefined
            }
            ilsCount={ilsCount}
          />
        )}
      </ScrollArea>
    </div>
  );
}

interface GateListProps {
  gates: StartupLocation[];
  onSelect: (gate: NamedPosition) => void;
  selectedName?: string;
}

function GateList({ gates, onSelect, selectedName }: GateListProps) {
  const { t } = useTranslation();

  if (gates.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">{t('sidebar.noGatesFound')}</p>
    );
  }

  return (
    <div className="space-y-1 pr-2">
      {gates.slice(0, 50).map((gate, i) => {
        const isSelected = selectedName === gate.name;
        return (
          <Button
            key={i}
            variant="ghost"
            onClick={() =>
              onSelect({
                latitude: gate.latitude,
                longitude: gate.longitude,
                name: gate.name,
              })
            }
            className={cn(
              'flex h-auto w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs',
              isSelected
                ? 'border border-success/30 bg-success/20 text-success hover:bg-success/30'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
      {gates.length > 50 && (
        <p className="pt-1 text-center text-xs text-muted-foreground/50">
          +{gates.length - 50} {t('sidebar.more')}
        </p>
      )}
    </div>
  );
}

interface RunwayListProps {
  runways: Runway[];
  onSelectEnd: (end: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedName?: string;
  ilsCount?: number;
}

function RunwayList({
  runways,
  onSelectEnd,
  onSelectRunway,
  selectedName,
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
      {runways.map((runway, i) => (
        <RunwayItem
          key={i}
          runway={runway}
          onSelectEnd={onSelectEnd}
          onSelect={() => onSelectRunway?.(runway)}
          selectedEndName={selectedName}
          ilsCount={ilsCount}
        />
      ))}
    </div>
  );
}

interface RunwayItemProps {
  runway: Runway;
  onSelect?: () => void;
  onSelectEnd: (end: NamedPosition) => void;
  selectedEndName?: string;
  ilsCount?: number;
}

function RunwayItem({ runway, onSelect, onSelectEnd, selectedEndName, ilsCount }: RunwayItemProps) {
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
    <div className="rounded-lg bg-muted/50 p-2.5">
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
        {[e1, e2].map((end) => {
          const isSelected = selectedEndName === end.name;
          return (
            <Button
              key={end.name}
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEnd({ name: end.name, latitude: end.latitude, longitude: end.longitude });
              }}
              className={cn(
                'h-auto flex-1 rounded px-2 py-1 font-mono text-xs font-medium',
                isSelected
                  ? 'border border-success/30 bg-success/20 text-success hover:bg-success/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
