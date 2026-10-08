import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnits } from '@/hooks/useUnits';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';

export type RunwayStartMode = 'threshold' | 'approach' | 'tow';

const RUNWAY_START_MODES: readonly RunwayStartMode[] = ['threshold', 'approach', 'tow'];

const APPROACH_DISTANCES = [1, 2, 3, 5, 8, 10, 15, 20] as const;

/** Inline start options panel shown under the selected runway */
export function RunwayStartOptions({
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
  const units = useUnits();

  return (
    <div className="border-border/40 bg-muted/20 mt-2 space-y-2.5 rounded-lg border p-3">
      {/* Mode toggle: Threshold / Approach / Tow */}
      <div className="flex items-center gap-1">
        {RUNWAY_START_MODES.map((m) => (
          <Button
            key={m}
            variant="ghost"
            size="xs"
            onClick={() => onSetMode(m)}
            className={cn(
              'flex-1',
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
            <span className="text-muted-foreground text-xs">
              {t('airportInfo.runway.distance')}
            </span>
            <span className="text-foreground font-mono text-sm">
              {units.distance(approachDistance as NauticalMiles)}
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
          <ToggleGroup
            type="single"
            size="xs"
            value={String(approachDistance)}
            onValueChange={(v) => v && onSetApproachDistance(Number(v))}
            className="flex-wrap justify-start"
          >
            {APPROACH_DISTANCES.map((d) => (
              <ToggleGroupItem key={d} value={String(d)} className="font-mono">
                {units.distance(d as NauticalMiles)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Tow controls */}
      {mode === 'tow' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onSetTowType('winch')}
              className={cn(
                'flex-1',
                towType === 'winch'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('airportInfo.runway.winch')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onSetTowType('tug')}
              className={cn(
                'flex-1',
                towType === 'tug'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('airportInfo.runway.tug')}
            </Button>
          </div>
          {towType === 'tug' && (
            <span className="text-muted-foreground text-xs">
              {t('airportInfo.runway.tugAircraft')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
