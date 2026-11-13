import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUnits } from '@/hooks/useUnits';
import {
  STAND_CODES,
  type StandCode,
  WIDTH_CODE_WINGSPAN_M,
  smallestStandCodeFor,
  standFits,
} from '@/lib/airports/standIdentity';
import { metersToFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { trackEvent } from '@/queries';
import { useMapStore } from '@/stores/mapStore';
import {
  type ExploreStandFilter,
  type ExploreTab,
  usePlanBuilderStore,
} from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { RangeRingCategory } from '@/types/layers';
import { toEndpoint } from '../AirportPicker';
import { LogbookTab } from './LogbookTab';
import { OnlineTab } from './OnlineTab';
import { RandomRouteFinder } from './RandomRouteFinder';
import { RoutesTab } from './RoutesTab';
import { WeatherTab } from './WeatherTab';
import { openPlannerForRoute } from './planRoute';

interface ExploreFlyoutProps {
  airports: Airport[];
  aircraftClass: RangeRingCategory;
  tab: ExploreTab;
  /** A random destination became the plan's arrival. */
  onRandomArrival: (icao: string) => void;
  onClose: () => void;
  docked: boolean;
  className?: string;
}

/**
 * Flyout beside the plan builder: ideas for where to fly. Every row ends in the plan —
 * a route fills both ends, a random or weather pick becomes the arrival.
 */
export function ExploreFlyout({
  airports,
  aircraftClass,
  tab,
  onRandomArrival,
  onClose,
  docked,
  className,
}: ExploreFlyoutProps) {
  const { t } = useTranslation();
  const departure = usePlanBuilderStore((s) => s.departure);
  const setArrival = usePlanBuilderStore((s) => s.setArrival);
  const routePreview = useMapStore((s) => s.routePreview);
  const setRoutePreview = useMapStore((s) => s.setRoutePreview);
  const units = useUnits();

  // Stand size filter, shared by the three lists: only airports whose widest stand takes
  // the aircraft. "Current aircraft" uses the wingspan X-Plane reports while connected.
  const minStand = usePlanBuilderStore((s) => s.exploreMinStand);
  const setMinStand = usePlanBuilderStore((s) => s.setExploreMinStand);
  const aircraftWingspanM = usePlaneStore((s) => s.state?.wingspanM ?? null);
  const aircraftCode =
    aircraftWingspanM !== null ? smallestStandCodeFor(aircraftWingspanM) : undefined;
  const minCode: StandCode | undefined =
    minStand === 'any' ? undefined : minStand === 'aircraft' ? aircraftCode : minStand;
  const fits = useCallback(
    (airport: Airport) => minCode === undefined || standFits(airport.maxStandCode, minCode),
    [minCode]
  );
  const fitAirports = useMemo(
    () => (minCode === undefined ? airports : airports.filter(fits)),
    [airports, fits, minCode]
  );
  const spanOf = (code: StandCode) =>
    units.shortDistance(metersToFeet(WIDTH_CODE_WINGSPAN_M[code]));

  // The preview line belongs to this panel; leave the map clean when it goes.
  useEffect(() => () => setRoutePreview(null), [setRoutePreview]);

  const pickArrival = (airport: Airport) => {
    setRoutePreview(null);
    setArrival(toEndpoint(airport));
    trackEvent('explore_item_selected', { tab });
  };
  const planRoute = (from: string, to: string) => {
    if (openPlannerForRoute(airports, from, to)) trackEvent('explore_item_selected', { tab });
  };

  return (
    <div
      data-map-dock={docked ? 'left' : undefined}
      data-map-profile-inset={docked ? '' : undefined}
      className={cn(
        'border-border/40 bg-card/95 flex flex-col overflow-hidden rounded-lg border backdrop-blur-sm',
        className
      )}
    >
      <header className="border-border/30 flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Compass className="text-primary h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-medium">{t(`explore.tabs.${tab}`)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={onClose}
          tooltip={t('common.close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="border-border/30 flex items-center gap-2 border-b px-4 py-2">
        <span className="xp-label shrink-0">{t('explore.gateFilter.label')}</span>
        <Select value={minStand} onValueChange={(v) => setMinStand(v as ExploreStandFilter)}>
          <SelectTrigger className="h-8 min-w-0 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('explore.gateFilter.any')}</SelectItem>
            {aircraftCode && (
              <SelectItem value="aircraft">
                {t('explore.gateFilter.aircraft', { span: spanOf(aircraftCode) })}
              </SelectItem>
            )}
            {STAND_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {t('explore.gateFilter.option', { code, span: spanOf(code) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {tab === 'random' && (
            <RandomRouteFinder
              airports={airports}
              candidates={fitAirports}
              selectedRoute={routePreview}
              onSelectRoute={setRoutePreview}
              originIcao={departure?.icao ?? null}
              aircraftClass={aircraftClass}
              onPick={(destination) => {
                pickArrival(destination);
                onRandomArrival(destination.icao);
              }}
            />
          )}
          {tab === 'routes' && <RoutesTab airports={fitAirports} onPlanRoute={planRoute} />}
          {tab === 'weather' && <WeatherTab airports={airports} fits={fits} onPick={pickArrival} />}
          {tab === 'online' && <OnlineTab airports={fitAirports} onPick={pickArrival} />}
          {tab === 'logbook' && <LogbookTab airports={fitAirports} onPlanRoute={planRoute} />}
        </div>
      </ScrollArea>
    </div>
  );
}
