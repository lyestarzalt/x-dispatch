import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dices, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useMapStore } from '@/stores/mapStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import type { RangeRingCategory } from '@/types/layers';
import { toEndpoint } from './AirportPicker';
import { RandomRouteFinder } from './RandomRouteFinder';

interface RandomDestinationPanelProps {
  airports: Airport[];
  aircraftClass: RangeRingCategory;
  /** An airport from the panel became the plan's arrival. */
  onArrivalPicked: (icao: string) => void;
  onClose: () => void;
  className?: string;
}

/** Flyout beside the plan builder: random arrivals from the plan's departure. */
export function RandomDestinationPanel({
  airports,
  aircraftClass,
  onArrivalPicked,
  onClose,
  className,
}: RandomDestinationPanelProps) {
  const { t } = useTranslation();
  const departure = usePlanBuilderStore((s) => s.departure);
  const setArrival = usePlanBuilderStore((s) => s.setArrival);
  const selectedRoute = useMapStore((s) => s.explore.selectedRoute);
  const setSelectedRoute = useMapStore((s) => s.setSelectedRoute);

  // The preview line belongs to this panel; leave the map clean when it goes.
  useEffect(() => () => setSelectedRoute(null), [setSelectedRoute]);

  return (
    <div
      className={cn(
        'border-border/40 bg-card/95 flex flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm',
        className
      )}
    >
      <header className="border-border/30 flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Dices className="text-primary h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-medium">{t('planBuilder.randomDestination')}</span>
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
          <RandomRouteFinder
            airports={airports}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            originIcao={departure?.icao ?? null}
            aircraftClass={aircraftClass}
            onPick={(destination) => {
              setSelectedRoute(null);
              setArrival(toEndpoint(destination));
              onArrivalPicked(destination.icao);
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
