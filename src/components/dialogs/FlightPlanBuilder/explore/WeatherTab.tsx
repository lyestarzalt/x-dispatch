import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import type { WeatherCategory } from '@/lib/weatherScan/parseMetarFeed';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { WEATHER_CATEGORIES, filterByCategory, trackEvent, useWeatherScanQuery } from '@/queries';
import { WEATHER_CATEGORY_ICON } from './weatherIcons';

const GATEWAY_URL = 'https://gateway.x-plane.com';

interface WeatherTabProps {
  airports: Airport[];
  /** A station in X-Plane was picked: it becomes the plan's arrival. */
  onPick: (airport: Airport) => void;
}

export function WeatherTab({ airports, onPick }: WeatherTabProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<WeatherCategory>('snow');
  const selectCategory = (key: WeatherCategory) => {
    setCategory(key);
    trackEvent('explore_filter_selected', { tab: 'weather', filter: key });
  };
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
      <ToggleGroup
        type="single"
        size="xs"
        variant="outline"
        value={category}
        onValueChange={(v) => v && selectCategory(v as WeatherCategory)}
        className="flex-wrap justify-start"
      >
        {WEATHER_CATEGORIES.map((key) => {
          const Icon = WEATHER_CATEGORY_ICON[key];
          return (
            <ToggleGroupItem key={key} value={key}>
              <Icon />
              {t(`explore.weather.categories.${key}`)}
              <span className="opacity-60">{counts[key] ?? 0}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

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
                onClick={() => known && onPick(airport)}
                onKeyDown={(event) => {
                  if (!known || (event.key !== 'Enter' && event.key !== ' ')) return;
                  event.preventDefault();
                  onPick(airport);
                }}
                className={cn(
                  'group flex w-full min-w-0 items-start gap-3 overflow-hidden rounded px-2 py-2 text-left transition-colors',
                  known
                    ? 'hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none'
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
                        className="text-2xs px-1 py-0 font-mono"
                      >
                        {code}
                      </Badge>
                    ))}
                    {observation.gustKt !== null && (
                      <Badge variant="warning" className="text-2xs px-1 py-0 font-mono">
                        G{observation.gustKt}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-2xs">
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
                      className="text-muted-foreground text-2xs flex items-center gap-1 underline-offset-2 hover:underline"
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
