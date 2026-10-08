import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import type { WeatherRadarControls } from '../hooks/useWeatherRadar';

interface WeatherRadarWidgetProps {
  controls: WeatherRadarControls;
}

export default function WeatherRadarWidget({ controls }: WeatherRadarWidgetProps) {
  const { t } = useTranslation();
  const {
    isPlaying,
    currentTimestamp,
    frameIndex,
    frameCount,
    play,
    pause,
    stepForward,
    stepBack,
  } = controls;

  const timeDisplay = useMemo(() => {
    if (currentTimestamp === null) return '--:--';
    const date = new Date(currentTimestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [currentTimestamp]);

  if (frameCount === 0) return null;

  return (
    <div
      className="absolute bottom-10 left-32 z-10"
      role="region"
      aria-label={t('weatherRadar.controls')}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2',
          'border-border/50 bg-card/90 shadow-xl',
          'backdrop-blur-xl'
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={stepBack}
          className="text-muted-foreground hover:text-foreground"
          tooltip={t('weatherRadar.previousFrame')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={isPlaying ? pause : play}
          className="text-primary hover:text-xp-cyan-light"
          tooltip={isPlaying ? t('replay.pause') : t('replay.play')}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={stepForward}
          className="text-muted-foreground hover:text-foreground"
          tooltip={t('weatherRadar.nextFrame')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="border-border/50 flex items-center gap-1.5 border-l pl-2">
          <span className="text-primary font-mono text-xs font-medium tabular-nums">
            {timeDisplay}
          </span>
          <span className="text-muted-foreground text-xs">
            {frameIndex + 1}/{frameCount}
          </span>
        </div>
      </div>
    </div>
  );
}
