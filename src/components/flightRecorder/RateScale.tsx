import { RATING_BG_CLASS } from '@/lib/flightRecorder/format';
import { cn } from '@/lib/utils/helpers';
import type { LandingRating } from '@/types/flightRecorder';

interface Band {
  rating: LandingRating;
  from: number;
  to: number;
}

/** Same thresholds as `landingRating`, laid out left to right from gentle to severe. */
const BANDS: Band[] = [
  { rating: 'butter', from: 0, to: 125 },
  { rating: 'great', from: 125, to: 250 },
  { rating: 'acceptable', from: 250, to: 350 },
  { rating: 'hard', from: 350, to: 600 },
  { rating: 'severe', from: 600, to: 750 },
];
const SCALE_MAX = BANDS[BANDS.length - 1]!.to;

function position(fpm: number): number {
  return (Math.min(SCALE_MAX, Math.max(0, -fpm)) / SCALE_MAX) * 100;
}

interface RateScaleProps {
  touchdownRateFpm: number;
  rating: LandingRating;
  /** Hides the threshold labels under the bar. */
  compact?: boolean;
  className?: string;
}

/** Touchdown rate against the rating bands, so the number has a visual context. */
export function RateScale({ touchdownRateFpm, rating, compact, className }: RateScaleProps) {
  const marker = position(touchdownRateFpm);
  return (
    <div className={cn('w-full', className)} aria-hidden>
      <div className="relative">
        <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
          {BANDS.map((band) => (
            <div
              key={band.rating}
              className={cn(
                RATING_BG_CLASS[band.rating],
                band.rating === rating ? 'opacity-90' : 'opacity-25'
              )}
              style={{ width: `${((band.to - band.from) / SCALE_MAX) * 100}%` }}
            />
          ))}
        </div>
        <div
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_hsl(var(--card))]"
          style={{ left: `${marker}%` }}
        />
      </div>
      {!compact && (
        <div className="relative mt-1 h-3 font-mono text-[10px] text-muted-foreground">
          {BANDS.slice(0, -1).map((band) => (
            <span
              key={band.rating}
              className="absolute -translate-x-1/2"
              style={{ left: `${(band.to / SCALE_MAX) * 100}%` }}
            >
              {-band.to}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
