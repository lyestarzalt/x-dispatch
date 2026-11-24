import { useTranslation } from 'react-i18next';
import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Degrees } from '@/types/units';

type BroadcastUse = 'arrival' | 'departure';
const ARRIVAL: BroadcastUse = 'arrival';
const DEPARTURE: BroadcastUse = 'departure';

function AtisBadge({ letter, use }: { letter: string; use?: BroadcastUse }) {
  const { t } = useTranslation();
  const Icon = use === 'arrival' ? PlaneLanding : use === 'departure' ? PlaneTakeoff : null;
  const useLabel =
    use === 'arrival'
      ? t('airportInfo.conditions.arrivals')
      : use === 'departure'
        ? t('airportInfo.conditions.departures')
        : undefined;
  return (
    <Badge
      variant="cat-emerald"
      className="text-2xs h-4 gap-1 px-1.5 font-mono"
      title={useLabel}
      aria-label={useLabel}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {t('airportInfo.atisLabel', { letter })}
    </Badge>
  );
}

export function ActiveRunwayLine({
  activeRunway,
  atisLetter,
}: {
  activeRunway: ActiveRunway | null;
  atisLetter: string | null;
}) {
  const { t } = useTranslation();
  if (!activeRunway) return null;

  // Landing and takeoff on different runways: one row each, in the weather rows' shape,
  // each with the letter of the broadcast that named it. Arrivals first, as in the
  // frequency list, and the runways in the runway list's green (GitHub #415).
  if (activeRunway.source === 'atis' && activeRunway.split) {
    const { arrivalLetter, departureLetter } = activeRunway;
    const row = (name: string, ends: string[], letter: string | null) => (
      <div className="flex items-baseline justify-between gap-3 py-0.5">
        <span className="xp-label min-w-0 truncate">{name}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {letter && <AtisBadge letter={letter} />}
          <span className="text-cat-emerald font-mono text-sm font-medium">{ends.join(', ')}</span>
        </span>
      </div>
    );
    return (
      <div className="mt-1.5 px-3 text-sm">
        {row(t('airportInfo.conditions.arrivals'), activeRunway.arrivals, arrivalLetter)}
        {row(t('airportInfo.conditions.departures'), activeRunway.departures, departureLetter)}
      </div>
    );
  }

  const isAtis = activeRunway.source === 'atis';
  // One runway for both: an arrival and a departure broadcast on different letters each
  // show, marked by use; otherwise the one letter that named it.
  const arrivalLetter = isAtis ? activeRunway.arrivalLetter : null;
  const departureLetter = isAtis ? activeRunway.departureLetter : null;
  const twoLetters = !!arrivalLetter && !!departureLetter && arrivalLetter !== departureLetter;
  const oneLetter = arrivalLetter ?? departureLetter ?? atisLetter;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs">
      <span className="text-muted-foreground shrink-0">
        {t(activeRunway.ends.length > 1 ? 'airportInfo.activeRunways' : 'airportInfo.activeRunway')}
      </span>
      <span className="text-cat-emerald font-mono font-medium">{activeRunway.ends.join(', ')}</span>
      {isAtis && twoLetters && (
        <>
          <AtisBadge letter={arrivalLetter} use={ARRIVAL} />
          <AtisBadge letter={departureLetter} use={DEPARTURE} />
        </>
      )}
      {isAtis && !twoLetters && oneLetter && <AtisBadge letter={oneLetter} />}
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
      windDeg: Degrees;
      windSpeed: number;
      deltaDeg: Degrees;
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
