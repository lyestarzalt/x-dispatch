import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Cloud,
  CloudRain,
  CloudSnow,
  ExternalLink,
  Eye,
  Haze,
  Snowflake,
  Sun,
  Wind,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/helpers';
import type { WeatherCategory } from '@/lib/weatherScan/parseMetarFeed';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { WEATHER_CATEGORIES, filterByCategory, useWeatherScanQuery } from '@/queries';

const GATEWAY_URL = 'https://gateway.x-plane.com';

const CATEGORY_ICON: Record<WeatherCategory, typeof CloudSnow> = {
  snow: CloudSnow,
  freezing: Snowflake,
  fog: Eye,
  lowVisibility: Eye,
  lowCeiling: Cloud,
  heavyPrecipitation: CloudRain,
  thunderstorm: Zap,
  severe: AlertTriangle,
  dustSand: Haze,
  strongWind: Wind,
  clear: Sun,
};

interface WeatherTabProps {
  airports: Airport[];
  onSelectAirport: (icao: string) => void;
}

export function WeatherTab({ airports, onSelectAirport }: WeatherTabProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<WeatherCategory>('snow');
  const { data, isLoading, isError } = useWeatherScanQuery();

  const airportsByIcao = useMemo(() => {
    const index = new Map<string, Airport>();
    for (const airport of airports) index.set(airport.icao.toUpperCase(), airport);
    return index;
  }, [airports]);

  const observations = useMemo(() => filterByCategory(data, category), [data, category]);

  const counts = useMemo(() => {
    const totals = {} as Record<WeatherCategory, number>;
    for (const key of WEATHER_CATEGORIES) totals[key] = 0;
    for (const observation of data ?? []) {
      for (const key of observation.categories) totals[key] += 1;
    }
    return totals;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="xp-label">{t('common.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center">
        <span className="xp-label">{t('explore.weather.error')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {WEATHER_CATEGORIES.map((key) => {
          const Icon = CATEGORY_ICON[key];
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors',
                category === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 text-muted-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-3 w-3" />
              {t(`explore.weather.categories.${key}`)}
              <span className="opacity-60">{counts[key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {observations.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t('explore.weather.noneNow')}
        </p>
      ) : (
        <div className="space-y-0.5">
          {observations.slice(0, 40).map((observation) => {
            const airport = airportsByIcao.get(observation.icao);
            const known = airport !== undefined;

            return (
              <div
                key={observation.icao}
                role={known ? 'button' : undefined}
                tabIndex={known ? 0 : undefined}
                onClick={() => known && onSelectAirport(observation.icao)}
                onKeyDown={(event) => {
                  if (!known || (event.key !== 'Enter' && event.key !== ' ')) return;
                  event.preventDefault();
                  onSelectAirport(observation.icao);
                }}
                className={cn(
                  'group flex w-full min-w-0 items-start gap-3 overflow-hidden rounded px-2 py-2 text-left transition-colors',
                  known
                    ? 'hover:bg-muted/50 focus-visible:bg-muted/50 cursor-pointer focus-visible:outline-none'
                    : 'cursor-default'
                )}
              >
                <span className="text-info mt-px shrink-0 font-mono text-sm font-semibold">
                  {observation.icao}
                </span>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground truncate text-sm font-medium">
                      {airport?.name ?? t('explore.weather.unknownStation')}
                    </span>
                    <span className="text-muted-foreground flex shrink-0 items-baseline gap-1.5 font-mono text-xs tabular-nums">
                      {observation.ceilingFeet !== null && (
                        <span>{observation.ceilingFeet.toLocaleString()}ft</span>
                      )}
                      <span>{observation.visibilityLabel ?? ''}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {observation.phenomena.slice(0, 4).map((code) => (
                      <Badge
                        key={code}
                        variant="secondary"
                        className="px-1 py-0 font-mono text-[10px]"
                      >
                        {code}
                      </Badge>
                    ))}
                    {observation.gustKt !== null && (
                      <Badge variant="warning" className="px-1 py-0 font-mono text-[10px]">
                        G{observation.gustKt}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-[10px]">
                      {t('explore.weather.minutesAgo', { minutes: observation.ageMinutes })}
                    </span>
                  </div>

                  {!known && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        window.appAPI.openExternal(GATEWAY_URL);
                      }}
                      className="text-muted-foreground flex items-center gap-1 text-[10px] underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {t('explore.weather.notInXPlane')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
