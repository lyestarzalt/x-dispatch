import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  Dices,
  Map as MapIcon,
  PlaneLanding,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { AirportPicker, toEndpoint } from '@/components/dialogs/FlightPlanBuilder/AirportPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { IcaoCode } from '@/components/ui/icao-code';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUnits } from '@/hooks/useUnits';
import { formatDuration } from '@/lib/flightRecorder/format';
import { minutesToNm } from '@/lib/flightplan/builder/geometry';
import { planningClass } from '@/lib/flightplan/builder/planningClass';
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
import { useAppStore } from '@/stores/appStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RangeRingCategory } from '@/types/layers';
import { WEATHER_CATEGORY_ICON } from './weatherIcons';

type LengthMode = 'time' | 'distance';

const CLASSES: RangeRingCategory[] = ['jet', 'turboprop', 'prop'];
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
  /**
   * Hosted by the plan builder: origin and class follow the plan and the row action
   * sets the arrival. Left out, the finder keeps its own and opens the plan builder.
   */
  plan?: {
    originIcao: string | null;
    onOriginChange: (airport: Airport | null) => void;
    aircraftClass: RangeRingCategory;
    onAircraftClassChange: (cls: RangeRingCategory) => void;
    onPick: (destination: Airport) => void;
  };
}

export function RandomRouteFinder({
  airports,
  selectedRoute,
  onSelectRoute,
  plan,
}: RandomRouteFinderProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const selectedIcao = useAppStore((s) => s.selectedAirportData?.id ?? null);
  const aircraftCategory = usePlaneStore((s) => s.state?.aircraftCategory);

  const [ownOriginIcao, setOwnOriginIcao] = useState<string | null>(selectedIcao);
  const [ownCls, setOwnCls] = useState<RangeRingCategory>(() => planningClass(aircraftCategory));
  const originIcao = plan ? plan.originIcao : ownOriginIcao;
  const cls = plan ? plan.aircraftClass : ownCls;
  const setCls = plan ? plan.onAircraftClassChange : setOwnCls;
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

  const toggleWeather = (key: WeatherCategory) =>
    setWeather((current) =>
      current.includes(key) ? current.filter((w) => w !== key) : [...current, key]
    );

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
    trackEvent('random_route_found', {
      source: plan ? 'planner' : 'explore',
      results: routes.length,
    });
  };

  const pick = (destination: Airport) => {
    if (plan) {
      plan.onPick(destination);
      return;
    }
    if (!origin) return;
    const builder = usePlanBuilderStore.getState();
    builder.setDeparture(toEndpoint(origin));
    builder.setArrival(toEndpoint(destination));
    builder.setAircraftClass(cls);
    builder.open();
  };

  const actionLabel = plan ? t('explorePanel.random.useAsArrival') : t('explorePanel.random.plan');

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="xp-label">{t('explorePanel.random.from')}</span>
        <AirportPicker
          airports={airports}
          value={origin ? toEndpoint(origin) : null}
          placeholder={t('explorePanel.random.pickOrigin')}
          onChange={(endpoint) => {
            const airport = endpoint ? (airportsByIcao.get(endpoint.icao) ?? null) : null;
            if (plan) plan.onOriginChange(airport);
            else setOwnOriginIcao(airport?.icao ?? null);
            setResults(null);
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="xp-label min-w-0 truncate">{t('explorePanel.random.aircraft')}</span>
        <ToggleGroup
          type="single"
          size="xs"
          variant="outline"
          value={cls}
          onValueChange={(v) => v && setCls(v as RangeRingCategory)}
        >
          {CLASSES.map((c) => (
            <ToggleGroupItem key={c} value={c}>
              {t(`planBuilder.class.${c}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

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
          <span className="xp-value truncate text-xs">{rangeLabel}</span>
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
            <div className="flex flex-wrap gap-1">
              {WEATHER_CATEGORIES.map((key) => {
                const Icon = WEATHER_CATEGORY_ICON[key];
                const on = weather.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleWeather(key)}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/40 text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(`explore.weather.categories.${key}`)}
                  </button>
                );
              })}
            </div>
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
                  onClick={() => {
                    onSelectRoute({ from: origin.icao, to: route.airport.icao });
                    if (!plan) trackEvent('explore_item_selected', { tab: 'routes' });
                  }}
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
                      return <Icon key={w} className="h-3.5 w-3.5" />;
                    })}
                    {route.staffed && <Radio className="text-success h-3.5 w-3.5" />}
                  </span>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => pick(route.airport)}
                      aria-label={actionLabel}
                    >
                      {plan ? (
                        <PlaneLanding className="h-3.5 w-3.5" />
                      ) : (
                        <MapIcon className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{actionLabel}</TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
