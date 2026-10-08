import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/helpers';

export function ActiveRunwayLine({
  activeRunway,
  atisLetter,
}: {
  activeRunway: ActiveRunway | null;
  atisLetter: string | null;
}) {
  const { t } = useTranslation();
  if (!activeRunway) return null;
  const isAtis = activeRunway.source === 'atis';
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-xs">
      <span className="text-muted-foreground">{t('airportInfo.activeRunway')}</span>
      <span
        className={cn('font-mono font-medium', isAtis ? 'text-cat-emerald' : 'text-foreground')}
      >
        {activeRunway.ends.join(', ')}
      </span>
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

/**
 * Active runway resolved for the panel. `source` records where it came from
 * so the UI can label "ATIS" (authoritative) vs "wind-aligned" (heuristic).
 * `ends` is upper-cased so set-membership checks work without re-casing
 * downstream.
 */
export type ActiveRunway =
  | { source: 'atis'; ends: string[] }
  | {
      source: 'wind';
      ends: string[];
      windDeg: number;
      windSpeed: number;
      deltaDeg: number;
    };
