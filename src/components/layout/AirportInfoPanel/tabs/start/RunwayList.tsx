import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import type { Runway } from '@/types/apt';
import { NamedPosition } from '@/types/geo';
import { type RunwayStartMode, RunwayStartOptions } from './RunwayStartOptions';

interface RunwayListProps {
  runways: Runway[];
  searchQuery: string;
  onSelectEnd?: (end: NamedPosition) => void;
  onSelectRunway?: (runway: Runway) => void;
  selectedIndex?: number;
}

const DEFAULT_APPROACH_DISTANCE = 3.5;

function getRunwayStartMode(
  startPosition: ReturnType<typeof useAppStore.getState>['startPosition']
): RunwayStartMode {
  if (startPosition?.approachDistanceNm != null) return 'approach';
  if (startPosition?.towType) return 'tow';
  return 'threshold';
}

export function RunwayList({
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
      <p className="text-muted-foreground/60 py-8 text-center text-sm">
        {t('sidebar.noRunwaysFound')}
      </p>
    );
  }

  if (filteredRunways.length === 0) {
    return (
      <p className="text-muted-foreground/60 py-8 text-center text-sm">
        {t('airportInfo.noRunwaysMatching', { query: searchQuery })}
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
              className="focus-visible:ring-ring focus-visible:ring-offset-background mb-1.5 flex h-auto w-full items-baseline justify-between rounded px-0 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="text-foreground font-mono text-sm font-semibold">
                {e1.name}/{e2.name}
              </span>
              <span className="text-muted-foreground/50 text-2xs">
                {t('airportInfo.runwayDimensions', {
                  length: lengthFt.toLocaleString(),
                  width: widthFt,
                })}
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
