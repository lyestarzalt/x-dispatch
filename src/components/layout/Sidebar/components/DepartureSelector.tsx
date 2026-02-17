import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
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

  const airport = useAppStore((s) => s.selectedAirportData);
  const selectedStartPosition = useAppStore((s) => s.startPosition);

  const runways = useMemo(() => airport?.runways ?? [], [airport?.runways]);
  const gates = useMemo(() => airport?.startupLocations ?? [], [airport?.startupLocations]);

  return (
    <div>
      {/* Section title with selection status */}
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          {t('sidebar.departurePosition')}
        </h3>
        {selectedStartPosition && (
          <span className="font-mono text-sm font-medium text-emerald-400">
            {selectedStartPosition.name}
          </span>
        )}
      </div>

      {/* Segmented control - minimal */}
      <div className="mb-4 flex gap-1 border-b border-border/50">
        <button
          onClick={() => setDepartureType('gates')}
          className={cn(
            'pb-2 text-sm font-medium transition-colors',
            departureType === 'gates'
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Gates
          <span className="ml-1.5 text-muted-foreground/50">{gates.length}</span>
        </button>
        <button
          onClick={() => setDepartureType('runways')}
          className={cn(
            'ml-4 pb-2 text-sm font-medium transition-colors',
            departureType === 'runways'
              ? 'border-b-2 border-foreground text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Runways
          <span className="ml-1.5 text-muted-foreground/50">{runways.length}</span>
        </button>
      </div>

      {/* List - clean, no outer container */}
      <div className="max-h-64 overflow-y-auto">
        {departureType === 'gates' ? (
          <GateList
            gates={gates}
            onSelect={onSelectGate}
            selectedIndex={
              selectedStartPosition?.type === 'ramp' ? selectedStartPosition.index : undefined
            }
          />
        ) : (
          <RunwayList
            runways={runways}
            onSelectEnd={onSelectRunwayEnd}
            onSelectRunway={onSelectRunway}
            selectedIndex={
              selectedStartPosition?.type === 'runway' ? selectedStartPosition.index : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

interface GateListProps {
  gates: StartupLocation[];
  onSelect: (gate: NamedPosition) => void;
  selectedIndex?: number;
}

function GateList({ gates, onSelect, selectedIndex }: GateListProps) {
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

  if (gates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        {t('sidebar.noGatesFound')}
      </p>
    );
  }

  return (
    <div className="space-y-px">
      {gates.map((gate, idx) => {
        const isSelected = selectedIndex === idx;

        return (
          <button
            key={idx}
            onClick={() =>
              onSelect({
                latitude: gate.latitude,
                longitude: gate.longitude,
                name: gate.name,
                index: idx,
                xplaneIndex: xplaneIndices[idx],
              })
            }
            className={cn(
              'flex w-full items-center justify-between py-2 text-left transition-colors',
              isSelected ? 'text-emerald-400' : 'text-foreground/70 hover:text-foreground'
            )}
          >
            <span className="font-mono text-sm">{gate.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/40">{Math.round(gate.heading)}°</span>
              {isSelected && <Check className="h-4 w-4" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface RunwayListProps {
  runways: Runway[];
  onSelectEnd: (end: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedIndex?: number;
}

function RunwayList({ runways, onSelectEnd, onSelectRunway, selectedIndex }: RunwayListProps) {
  const { t } = useTranslation();

  if (runways.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        {t('sidebar.noRunwaysFound')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {runways.map((runway, runwayIndex) => {
        const e1 = runway.ends[0];
        const e2 = runway.ends[1];
        const lengthFt = Math.round(runwayLengthFeet(e1, e2));
        const widthFt = Math.round(metersToFeet(runway.width));

        return (
          <div key={runwayIndex}>
            {/* Runway header */}
            <button
              onClick={() => onSelectRunway?.(runway)}
              className="flex w-full items-baseline justify-between py-1 text-left"
            >
              <span className="font-mono text-sm font-medium text-foreground">
                {e1.name}/{e2.name}
              </span>
              <span className="text-xs text-muted-foreground/50">
                {lengthFt}' × {widthFt}'
              </span>
            </button>

            {/* Runway ends */}
            <div className="mt-1.5 flex gap-2">
              {[e1, e2].map((end, endIndex) => {
                const globalEndIndex = runwayIndex * 2 + endIndex;
                const isSelected = selectedIndex === globalEndIndex;

                return (
                  <button
                    key={end.name}
                    onClick={() =>
                      onSelectEnd({
                        name: end.name,
                        latitude: end.latitude,
                        longitude: end.longitude,
                        index: globalEndIndex,
                        xplaneIndex: `${runwayIndex}_${endIndex}`,
                      })
                    }
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 font-mono text-sm transition-colors',
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    {end.name}
                    {isSelected && <Check className="h-3.5 w-3.5" />}
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
