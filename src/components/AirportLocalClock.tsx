import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import tzLookup from 'tz-lookup';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useClock } from '@/hooks/useClock';
import { formatAirportLocalTime } from '@/lib/utils/clock';
import { cn } from '@/lib/utils/helpers';
import logger from '@/lib/utils/loggerRenderer';

interface AirportLocalClockProps {
  icao: string;
  latitude: number;
  longitude: number;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * The wall clock at the selected airport, ticking on the app clock so it
 * agrees with the toolbar: sim time while X-Plane is followed, the machine
 * clock otherwise. Owns the ticking hook so the surrounding screen does not
 * re-render every second. Shown in the airport panel and the planner header.
 */
export function AirportLocalClock({
  icao,
  latitude,
  longitude,
  align = 'left',
  className,
}: AirportLocalClockProps) {
  const { t } = useTranslation();
  const { timeMs, source } = useClock();

  const timeZone = useMemo(() => {
    try {
      return tzLookup(latitude, longitude);
    } catch (error) {
      logger.renderer.warn(`Time zone lookup failed for ${icao}`, error);
      return null;
    }
  }, [icao, latitude, longitude]);

  if (!timeZone) return null;
  const { time, offset } = formatAirportLocalTime(timeMs, timeZone);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'text-muted-foreground flex shrink-0 items-baseline gap-1 font-mono text-xs tabular-nums',
            align === 'right' && 'justify-end',
            className
          )}
        >
          <span className="text-foreground">{time}</span>
          <span>{offset}</span>
          {source === 'sim' && (
            <span className="text-primary font-semibold">{t('toolbar.clock.badgeSim')}</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side={align === 'right' ? 'left' : 'right'}>
        <p>{t('airportInfo.localTime', { icao })}</p>
        <p className="opacity-80">
          {source === 'sim' ? t('toolbar.clock.sourceSim') : t('toolbar.clock.sourceSystem')}
        </p>
        <p className="opacity-80">{timeZone}</p>
      </TooltipContent>
    </Tooltip>
  );
}
