import { useTranslation } from 'react-i18next';
import { Crosshair, Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatClock } from '@/lib/flightRecorder/format';
import { sampleTrack } from '@/lib/flightRecorder/trailGeometry';
import { cn } from '@/lib/utils/helpers';
import { REPLAY_SPEEDS, useFlightRecorderStore } from '@/stores/flightRecorderStore';

/** Transport controls for a replayed flight. Rendered only while a replay is loaded. */
export default function ReplayWidget() {
  const { t } = useTranslation();
  const replay = useFlightRecorderStore((s) => s.replay);
  const stopReplay = useFlightRecorderStore((s) => s.stopReplay);
  const setCursor = useFlightRecorderStore((s) => s.setReplayCursor);
  const setPlaying = useFlightRecorderStore((s) => s.setReplayPlaying);
  const setSpeed = useFlightRecorderStore((s) => s.setReplaySpeed);
  const setFollow = useFlightRecorderStore((s) => s.setReplayFollow);

  if (!replay || replay.track.length === 0) return null;

  const start = replay.track[0]![0];
  const end = replay.track[replay.track.length - 1]![0];
  const total = Math.max(1, end - start);
  const elapsed = replay.cursorMs - start;
  const sample = sampleTrack(replay.track, replay.cursorMs);

  const nextSpeed = () => {
    const idx = REPLAY_SPEEDS.indexOf(replay.speed as (typeof REPLAY_SPEEDS)[number]);
    setSpeed(REPLAY_SPEEDS[(idx + 1) % REPLAY_SPEEDS.length]!);
  };

  return (
    <div className="border-border/60 bg-background/90 w-[480px] rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => setPlaying(!replay.playing)}
          tooltip={replay.playing ? t('replay.pause') : t('replay.play')}
        >
          {replay.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-14 font-mono"
          onClick={nextSpeed}
          tooltip={t('replay.speedTooltip')}
        >
          {t('replay.speed', { speed: replay.speed })}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className={cn('h-8 w-8', replay.follow && 'border-primary/50 text-primary')}
          onClick={() => setFollow(!replay.follow)}
          tooltip={t('replay.follow')}
        >
          <Crosshair className="h-4 w-4" />
        </Button>
        <div className="text-muted-foreground flex-1 font-mono text-xs">
          <span className="text-foreground">{formatClock(elapsed / 1000)}</span>
          {' / '}
          {formatClock(total / 1000)}
        </div>
        {sample && (
          <div className="text-muted-foreground flex gap-3 font-mono text-xs">
            <span>
              {Math.round(sample.alt).toLocaleString()} {t('units.ft')}
            </span>
            <span>
              {Math.round(sample.gs)} {t('units.kt')}
            </span>
          </div>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={stopReplay}
          tooltip={t('replay.stop')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Slider
        className="mt-3"
        min={0}
        max={total}
        step={1000}
        value={[Math.max(0, Math.min(total, elapsed))]}
        onValueChange={([v]) => {
          if (v !== undefined) setCursor(start + v);
        }}
        aria-label={t('replay.title')}
      />
    </div>
  );
}
