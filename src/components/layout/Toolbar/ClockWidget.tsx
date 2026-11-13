import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClock } from '@/hooks/useClock';
import { formatClock } from '@/lib/utils/clock';
import { cn } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Toolbar clock with two segments. Left segment: the time; click
 * to switch Zulu / local. Right segment: the clock source; click to switch
 * between the simulator clock and the machine clock. The source writes the
 * same "follow X-Plane time" setting the Graphics section exposes, so the
 * day/night rendering flips with it.
 */
export function ClockWidget() {
  const { t } = useTranslation();
  const clockMode = useSettingsStore((s) => s.appearance.clockMode);
  const setClockMode = useSettingsStore((s) => s.setClockMode);
  const followSimTime = useSettingsStore((s) => s.graphics.followSimTime);
  const updateGraphicsSettings = useSettingsStore((s) => s.updateGraphicsSettings);
  const { timeMs, source } = useClock();

  const nextMode = clockMode === 'zulu' ? 'local' : 'zulu';
  const switchModeHint = t(
    nextMode === 'local' ? 'toolbar.clock.switchToLocal' : 'toolbar.clock.switchToZulu'
  );
  const sourceLabel =
    source === 'sim' ? t('toolbar.clock.sourceSim') : t('toolbar.clock.sourceSystem');
  const modeLabel = clockMode === 'zulu' ? t('toolbar.clock.zulu') : t('toolbar.clock.local');
  const simWantedButOffline = followSimTime && source !== 'sim';
  const sourceHint = simWantedButOffline
    ? t('toolbar.clock.simNotConnected')
    : t(followSimTime ? 'toolbar.clock.switchToSystem' : 'toolbar.clock.switchToSim');

  const segment = 'h-full rounded-md focus-visible:ring-inset focus-visible:ring-offset-0';

  return (
    <div className="flex h-8 shrink-0 items-stretch gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => setClockMode(nextMode)}
            className={cn(segment, 'gap-1.5 px-1.5')}
            aria-label={switchModeHint}
          >
            <Clock className="text-muted-foreground hidden h-4 w-4 xl:block" />
            <span className="text-info font-mono text-base font-bold tabular-nums">
              {formatClock(timeMs, clockMode)}
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold">
              {clockMode === 'zulu'
                ? t('toolbar.clock.zuluSuffix')
                : t('toolbar.clock.localSuffix')}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>
            {sourceLabel}, {modeLabel}
          </p>
          <p className="opacity-80">{switchModeHint}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => updateGraphicsSettings({ followSimTime: !followSimTime })}
            className={cn(
              segment,
              'px-1.5 font-mono text-xs font-semibold',
              source === 'sim' ? 'text-primary' : 'text-muted-foreground',
              simWantedButOffline && 'opacity-60'
            )}
            aria-label={t('toolbar.clock.toggleSource')}
          >
            {source === 'sim' ? t('toolbar.clock.badgeSim') : t('toolbar.clock.badgeSystem')}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{sourceLabel}</p>
          <p className="opacity-80">{sourceHint}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
