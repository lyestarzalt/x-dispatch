import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
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

  // Only show tabs that have data
  const tabs = [
    { id: 'gates' as const, label: 'Gates', count: gates.length },
    { id: 'runways' as const, label: 'Runways', count: runways.length },
    { id: 'helipads' as const, label: 'Helipads', count: helipads.length },
  ].filter((tab) => tab.count > 0);

  // If only one category exists, don't show tabs
  if (tabs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground/60">
        No starting positions available
      </p>
    );
  }

  return (
    <div>
      {/* View toggle - only show if multiple categories */}
      {tabs.length > 1 && (
        <div className="mb-6 flex gap-4 border-b border-border/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewType(tab.id)}
              className={cn(
                '-mb-px pb-3 text-sm font-medium transition-colors',
                viewType === tab.id
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              <span className="ml-2 text-muted-foreground/50">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {viewType === 'gates' && (
        <GateList
          gates={gates}
          onSelect={onSelectGate}
          selectedIndex={
            selectedStartPosition?.type === 'ramp' ? selectedStartPosition.index : undefined
          }
        />
      )}
      {viewType === 'runways' && (
        <RunwayList
          runways={runways}
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
  onSelect?: (gate: NamedPosition) => void;
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
      <p className="py-12 text-center text-sm text-muted-foreground/60">
        {t('sidebar.noGatesFound')}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {gates.map((gate, idx) => {
        const isSelected = selectedIndex === idx;

        return (
          <button
            key={idx}
            onClick={() =>
              onSelect?.({
                latitude: gate.latitude,
                longitude: gate.longitude,
                name: gate.name,
                heading: gate.heading,
                index: idx,
                xplaneIndex: xplaneIndices[idx],
              })
            }
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
              isSelected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
          >
            <span className="font-mono text-sm">{gate.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/50">{Math.round(gate.heading)}°</span>
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
  onSelectEnd?: (end: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedIndex?: number;
}

function RunwayList({ runways, onSelectEnd, onSelectRunway, selectedIndex }: RunwayListProps) {
  const { t } = useTranslation();

  if (runways.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground/60">
        {t('sidebar.noRunwaysFound')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
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
              className="mb-2 flex w-full items-baseline justify-between text-left"
            >
              <span className="font-mono text-sm font-semibold text-foreground">
                {e1.name}/{e2.name}
              </span>
              <span className="text-xs text-muted-foreground/50">
                {lengthFt.toLocaleString()}' × {widthFt}'
              </span>
            </button>

            {/* Runway ends */}
            <div className="flex gap-2">
              {[e1, e2].map((end, endIndex) => {
                const globalEndIndex = runwayIndex * 2 + endIndex;
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
                        xplaneIndex: `${runwayIndex}_${endIndex}`,
                      })
                    }
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-mono text-sm transition-colors',
                      isSelected
                        ? 'bg-emerald-500/10 text-emerald-400'
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

interface HelipadListProps {
  helipads: Helipad[];
  runwayCount: number;
  onSelect?: (helipad: NamedPosition) => void;
  selectedIndex?: number;
}

function HelipadList({ helipads, runwayCount, onSelect, selectedIndex }: HelipadListProps) {
  if (helipads.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground/60">No helipads found</p>;
  }

  return (
    <div className="space-y-1">
      {helipads.map((helipad, idx) => {
        const isSelected = selectedIndex === idx;
        const sizeFt = `${Math.round(metersToFeet(helipad.length))}' × ${Math.round(metersToFeet(helipad.width))}'`;
        // X-Plane index: helipads share row counter with runways, format is "row_0"
        const xplaneIndex = `${runwayCount + idx}_0`;

        return (
          <button
            key={idx}
            onClick={() =>
              onSelect?.({
                latitude: helipad.latitude,
                longitude: helipad.longitude,
                name: helipad.name,
                heading: helipad.heading,
                index: idx,
                xplaneIndex,
              })
            }
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
              isSelected
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'text-foreground/80 hover:bg-muted/50'
            )}
          >
            <span className="font-mono text-sm">{helipad.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground/50">{sizeFt}</span>
              {isSelected && <Check className="h-4 w-4" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
