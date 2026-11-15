import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function ActiveRunwayLine({
  activeRunway,
  atisLetter,
}: {
  activeRunway: ActiveRunway | null;
  atisLetter: string | null;
}) {
  const { t } = useTranslation();
  if (!activeRunway) return null;

  // Landing and takeoff on different runways: one row each, in the weather rows' shape.
  // The ATIS letter shows once when both rows come from the same broadcast.
  if (activeRunway.source === 'atis' && activeRunway.split) {
    const { arrivalLetter, departureLetter } = activeRunway;
    const oneLetter = arrivalLetter === departureLetter;
    const row = (name: string, ends: string[], letter: string | null) => (
      <div className="flex items-baseline justify-between gap-3 py-0.5">
        <span className="xp-label min-w-0 truncate">{name}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {letter && (
            <Badge variant="cat-emerald" className="text-2xs h-4 px-1.5 font-mono">
              {t('airportInfo.atisLabel', { letter })}
            </Badge>
          )}
          <span className="xp-value text-cat-emerald font-medium">{ends.join(', ')}</span>
        </span>
      </div>
    );
    return (
      <div className="mt-1.5 px-3 text-sm">
        {row(t('airportInfo.conditions.departures'), activeRunway.departures, departureLetter)}
        {row(
          t('airportInfo.conditions.arrivals'),
          activeRunway.arrivals,
          oneLetter ? null : arrivalLetter
        )}
      </div>
    );
  }

  const isAtis = activeRunway.source === 'atis';
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs">
      <span className="text-muted-foreground shrink-0">
        {t(activeRunway.ends.length > 1 ? 'airportInfo.activeRunways' : 'airportInfo.activeRunway')}
      </span>
      <span className="text-cat-emerald font-mono font-medium">{activeRunway.ends.join(', ')}</span>
      {isAtis && atisLetter && (
        <Badge variant="cat-emerald" className="text-2xs h-4 px-1.5 font-mono">
          {t('airportInfo.atisLabel', { letter: atisLetter })}
        </Badge>
      )}
      {!isAtis && (
        <span className="text-muted-foreground/60">
          {t('airportInfo.windAligned', { delta: activeRunway.deltaDeg })}
        </span>
      )}
    </div>
  );
}

/** How an active runway end is used; `any` when the ATIS does not tell landing from takeoff. */
export type EndUse = 'arrival' | 'departure' | 'both' | 'any';

/**
 * Active runway resolved for the panel. `source` records where it came from
 * so the UI can label "ATIS" (authoritative) vs "wind-aligned" (heuristic).
 * `ends` is upper-cased so set-membership checks work without re-casing
 * downstream. `split` is set when the ATIS gives different runways for
 * landing and takeoff.
 */
export type ActiveRunway =
  | {
      source: 'atis';
      ends: string[];
      split: boolean;
      arrivals: string[];
      departures: string[];
      arrivalLetter: string | null;
      departureLetter: string | null;
    }
  | {
      source: 'wind';
      ends: string[];
      windDeg: number;
      windSpeed: number;
      deltaDeg: number;
    };

/** Each active end with its use, for the runway list's colours. */
export function activeEndUse(activeRunway: ActiveRunway | null): Map<string, EndUse> {
  const use = new Map<string, EndUse>();
  if (!activeRunway) return use;
  for (const end of activeRunway.ends) use.set(end, 'any');
  if (activeRunway.source === 'atis' && activeRunway.split) {
    for (const end of activeRunway.ends) use.set(end, 'both');
    const departures = new Set(activeRunway.departures);
    for (const end of activeRunway.arrivals) if (!departures.has(end)) use.set(end, 'arrival');
    const arrivals = new Set(activeRunway.arrivals);
    for (const end of activeRunway.departures) if (!arrivals.has(end)) use.set(end, 'departure');
  }
  return use;
}
