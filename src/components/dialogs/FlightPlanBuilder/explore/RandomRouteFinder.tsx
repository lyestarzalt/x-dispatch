import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Dices, PlaneLanding, Radio, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { IcaoCode } from '@/components/ui/icao-code';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnits } from '@/hooks/useUnits';
import { formatDuration } from '@/lib/flightRecorder/format';
import { minutesToNm } from '@/lib/flightplan/builder/geometry';
import {
  type RandomRoute,
  type RouteScope,
  findRandomRoutes,
} from '@/lib/flightplan/builder/randomRoute';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { WeatherCategory } from '@/lib/weatherScan/parseMetarFeed';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { WEATHER_CATEGORIES, trackEvent, useWeatherScanQuery } from '@/queries';
import { getStaffedCallsignPrefixes, useVatsimQuery } from '@/queries/useVatsimQuery';
import type { RangeRingCategory } from '@/types/layers';
import { WEATHER_CATEGORY_ICON } from './weatherIcons';

type LengthMode = 'time' | 'distance';

const SCOPES: RouteScope[] = ['any', 'domestic', 'international'];

/** Slider bounds: minutes for time, nautical miles for distance. */
const LENGTH_RANGE: Record<LengthMode, { min: number; max: number; step: number; init: number[] }> =
  {
    time: { min: 30, max: 600, step: 15, init: [60, 120] },
    distance: { min: 25, max: 3000, step: 25, init: [150, 500] },
  };

interface RandomRouteFinderProps {
  airports: Airport[];
  selectedRoute: { from: string; to: string } | null;
  onSelectRoute: (route: { from: string; to: string } | null) => void;
  /** The plan's departure and class, edited in the plan builder itself. */
  originIcao: string | null;
  aircraftClass: RangeRingCategory;
  /** The row action: this airport becomes the plan's arrival. */
  onPick: (destination: Airport) => void;
}

export function RandomRouteFinder({
  airports,
  selectedRoute,
  onSelectRoute,
  originIcao,
  aircraftClass: cls,
  onPick,
}: RandomRouteFinderProps) {
  const { t } = useTranslation();
  const units = useUnits();

  const [mode, setMode] = useState<LengthMode>('time');
  const [range, setRange] = useState<number[]>(LENGTH_RANGE.time.init);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scope, setScope] = useState<RouteScope>('any');
  const [customOnly, setCustomOnly] = useState(false);
  const [atcOnly, setAtcOnly] = useState(false);
  const [weather, setWeather] = useState<WeatherCategory[]>([]);
  const [results, setResults] = useState<RandomRoute[] | null>(null);

  const weatherQuery = useWeatherScanQuery(weather.length > 0);
  const vatsimQuery = useVatsimQuery(atcOnly);
  const waiting =
    (weather.length > 0 && weatherQuery.isLoading) || (atcOnly && vatsimQuery.isLoading);

  const airportsByIcao = useMemo(() => {
    const index = new Map<string, Airport>();
    for (const airport of airports) index.set(airport.icao, airport);
    return index;
  }, [airports]);
  const origin = originIcao ? (airportsByIcao.get(originIcao) ?? null) : null;

  const [low = 0, high = 0] = range;
  const bandNm =
    mode === 'time'
      ? { min: minutesToNm(low, cls), max: minutesToNm(high, cls) }
      : { min: low, max: high };
  const rangeLabel =
    mode === 'time'
      ? `${formatDuration(low * 60)} – ${formatDuration(high * 60)}`
      : `${units.distance(low as NauticalMiles)} – ${units.distance(high as NauticalMiles)}`;
  const activeFilters =
    (scope !== 'any' ? 1 : 0) + (customOnly ? 1 : 0) + (atcOnly ? 1 : 0) + (weather.length ? 1 : 0);

  const changeMode = (next: string) => {
    if (!next) return;
    setMode(next as LengthMode);
    setRange(LENGTH_RANGE[next as LengthMode].init);
  };

  const roll = () => {
    if (!origin) return;
    const weatherByIcao = new Map<string, WeatherCategory[]>();
    for (const observation of weatherQuery.data ?? []) {
      weatherByIcao.set(observation.icao, observation.categories);
    }
    const routes = findRandomRoutes(
      airports,
      origin,
      {
        minNm: bandNm.min,
        maxNm: bandNm.max,
        category: cls,
        scope,
        customOnly,
        weather,
        atcOnly,
      },
      { weatherByIcao, staffedPrefixes: getStaffedCallsignPrefixes(vatsimQuery.data) }
    );
    setResults(routes);
    onSelectRoute(routes[0] ? { from: origin.icao, to: routes[0].airport.icao } : null);
    trackEvent('random_route_found', { results: routes.length });
  };

  return (
    <div className="space-y-4">
      <p className="xp-label flex min-w-0 items-center gap-1.5">
        <span className="shrink-0">{t('explorePanel.random.from')}</span>
        {origin ? (
          <>
            <IcaoCode className="text-sm">{origin.icao}</IcaoCode>
            <span className="truncate">· {t(`planBuilder.class.${cls}`)}</span>
          </>
        ) : (
          <span className="truncate">{t('explorePanel.random.needOrigin')}</span>
        )}
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            size="xs"
            variant="outline"
            value={mode}
            onValueChange={changeMode}
          >
            <ToggleGroupItem value="time">{t('explorePanel.random.time')}</ToggleGroupItem>
            <ToggleGroupItem value="distance">{t('explorePanel.random.distance')}</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-foreground truncate font-mono text-xs tabular-nums">
            {rangeLabel}
          </span>
        </div>
        <Slider
          value={range}
          min={LENGTH_RANGE[mode].min}
          max={LENGTH_RANGE[mode].max}
          step={LENGTH_RANGE[mode].step}
          minStepsBetweenThumbs={1}
          onValueChange={setRange}
          aria-label={t('explorePanel.random.length')}
        />
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger className="xp-label hover:text-foreground flex w-full items-center gap-2 transition-colors">
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">{t('explorePanel.random.filters')}</span>
          {activeFilters > 0 && (
            <Badge variant="info" className="px-1.5 py-0 font-mono">
              {activeFilters}
            </Badge>
          )}
          <ChevronRight
            className={cn('ml-auto h-4 w-4 transition-transform', filtersOpen && 'rotate-90')}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <ToggleGroup
            type="single"
            size="xs"
            variant="outline"
            value={scope}
            onValueChange={(v) => v && setScope(v as RouteScope)}
            className="w-full"
          >
            {SCOPES.map((s) => (
              <ToggleGroupItem key={s} value={s} className="min-w-0 flex-1">
                <span className="truncate">{t(`explorePanel.random.scope.${s}`)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <label className="flex items-center justify-between gap-2">
            <span className="xp-label min-w-0 truncate">{t('explorePanel.random.customOnly')}</span>
            <Switch checked={customOnly} onCheckedChange={setCustomOnly} />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="xp-label min-w-0 truncate">{t('explorePanel.random.atcOnly')}</span>
            <Switch checked={atcOnly} onCheckedChange={setAtcOnly} />
          </label>

          <div className="space-y-1.5">
            <span className="xp-label">{t('explorePanel.random.weather')}</span>
            <ToggleGroup
              type="multiple"
              size="xs"
              variant="outline"
              value={weather}
              onValueChange={(v) => setWeather(v as WeatherCategory[])}
              className="flex-wrap justify-start"
            >
              {WEATHER_CATEGORIES.map((key) => {
                const Icon = WEATHER_CATEGORY_ICON[key];
                return (
                  <ToggleGroupItem key={key} value={key}>
                    <Icon />
                    {t(`explore.weather.categories.${key}`)}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button className="w-full" size="sm" disabled={!origin || waiting} onClick={roll}>
        <Dices className="h-4 w-4" />
        {results ? t('explorePanel.random.reroll') : t('explorePanel.random.roll')}
      </Button>

      {results && results.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-xs">
          {t('explorePanel.random.noMatch')}
        </p>
      )}

      {results && results.length > 0 && origin && (
        <div className="space-y-0.5">
          {results.map((route) => {
            const active =
              selectedRoute?.from === origin.icao && selectedRoute?.to === route.airport.icao;
            return (
              <div
                key={route.airport.icao}
                className={cn(
                  'group flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 transition-colors',
                  active ? 'bg-primary/10' : 'hover:bg-muted/50'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectRoute({ from: origin.icao, to: route.airport.icao })}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span className="flex w-full min-w-0 items-baseline gap-2">
                    <IcaoCode className={cn('text-sm', active ? 'text-primary' : 'text-info')}>
                      {route.airport.icao}
                    </IcaoCode>
                    <span className="text-foreground min-w-0 truncate text-sm">
                      {route.airport.name}
                    </span>
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tabular-nums">
                    {units.distance(route.distanceNm as NauticalMiles)}
                    <span>·</span>
                    {formatDuration(route.minutes * 60)}
                    {route.weather.slice(0, 3).map((w) => {
                      const Icon = WEATHER_CATEGORY_ICON[w];
                      return (
                        <Icon
                          key={w}
                          role="img"
                          aria-label={t(`explore.weather.categories.${w}`)}
                          className="h-3.5 w-3.5"
                        />
                      );
                    })}
                    {route.staffed && (
                      <Radio
                        role="img"
                        aria-label={t('explorePanel.random.atcOnly')}
                        className="text-success h-3.5 w-3.5"
                      />
                    )}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => onPick(route.airport)}
                  tooltip={t('explorePanel.random.useAsArrival')}
                >
                  <PlaneLanding className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
