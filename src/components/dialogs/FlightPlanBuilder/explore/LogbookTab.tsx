import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { IcaoCode } from '@/components/ui/icao-code';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useFlightsQuery } from '@/queries/useFlightsQuery';
import { GateSizeTag, smallerStandCode } from './GateSizeTag';
import { logbookPairs } from './logbookPairs';

interface LogbookTabProps {
  airports: Airport[];
  /** A pair from the logbook was picked: it becomes the plan's departure and arrival. */
  onPlanRoute: (from: string, to: string) => void;
}

/** City pairs the pilot has flown before, most flown first, one click to fly again. */
export function LogbookTab({ airports, onPlanRoute }: LogbookTabProps) {
  const { t, i18n } = useTranslation();
  const { data: flights, isLoading } = useFlightsQuery();

  const byIcao = useMemo(() => new Map(airports.map((a) => [a.icao, a])), [airports]);
  const pairs = useMemo(
    () => logbookPairs(flights ?? []).filter((p) => byIcao.has(p.from) && byIcao.has(p.to)),
    [flights, byIcao]
  );
  const dateOf = (at: number) =>
    new Date(at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="xp-label">{t('common.loading')}</span>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-xs">{t('explore.logbook.none')}</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {pairs.slice(0, 40).map((pair) => (
        <button
          key={`${pair.from}-${pair.to}`}
          onClick={() => onPlanRoute(pair.from, pair.to)}
          className="group hover:bg-muted/50 flex w-full min-w-0 items-center gap-2 overflow-hidden rounded px-2 py-1.5 text-left transition-colors"
        >
          <IcaoCode className="text-info shrink-0 text-sm">{pair.from}</IcaoCode>
          <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <IcaoCode className="text-info shrink-0 text-sm">{pair.to}</IcaoCode>
          <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs tabular-nums">
            {t('explore.logbook.flights', { count: pair.count })}
            {pair.aircraft ? ` · ${pair.aircraft}` : ''}
            {` · ${dateOf(pair.lastAt)}`}
          </span>
          <GateSizeTag
            code={smallerStandCode(
              byIcao.get(pair.from)?.maxStandCode,
              byIcao.get(pair.to)?.maxStandCode
            )}
            forRoute
          />
        </button>
      ))}
    </div>
  );
}
