import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import type { WeatherRadarControls } from '../hooks/useWeatherRadar';

interface WeatherRadarWidgetProps {
  controls: WeatherRadarControls;
}

export default function WeatherRadarWidget({ controls }: WeatherRadarWidgetProps) {
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
      aria-label="Weather radar controls"
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2',
          'border-white/[0.08] bg-[#0d1117]/90 shadow-2xl shadow-black/50',
          'backdrop-blur-xl'
        )}
      >
        <button
          onClick={stepBack}
          className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Previous frame"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={isPlaying ? pause : play}
          className="rounded p-1 text-cyan-400 transition-colors hover:bg-white/10 hover:text-cyan-300"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <button
          onClick={stepForward}
          className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Next frame"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
          <span className="font-mono text-xs font-medium tabular-nums text-cyan-400">
            {timeDisplay}
          </span>
          <span className="text-[10px] text-white/40">
            {frameIndex + 1}/{frameCount}
          </span>
        </div>
      </div>
    </div>
  );
}
