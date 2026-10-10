import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { trackEvent } from '@/queries';
import { useMapStore } from '@/stores/mapStore';
import { type ExploreTab, usePlanBuilderStore } from '@/stores/planBuilderStore';
import type { RangeRingCategory } from '@/types/layers';
import { toEndpoint } from '../AirportPicker';
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
  className,
}: ExploreFlyoutProps) {
  const { t } = useTranslation();
  const departure = usePlanBuilderStore((s) => s.departure);
  const setArrival = usePlanBuilderStore((s) => s.setArrival);
  const routePreview = useMapStore((s) => s.routePreview);
  const setRoutePreview = useMapStore((s) => s.setRoutePreview);

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
      className={cn(
        'border-border/40 bg-card/95 flex flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm',
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
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {tab === 'random' && (
            <RandomRouteFinder
              airports={airports}
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
          {tab === 'routes' && <RoutesTab airports={airports} onPlanRoute={planRoute} />}
          {tab === 'weather' && <WeatherTab airports={airports} onPick={pickArrival} />}
        </div>
      </ScrollArea>
    </div>
  );
}
