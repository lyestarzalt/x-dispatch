import { useTranslation } from 'react-i18next';
import { Calendar, MapPin, Plane } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import {
  getEventStatus,
  getEventTimeInfo,
  useVatsimEventsQuery,
} from '@/queries/useVatsimEventsQuery';
import { getBusiestAirports, useVatsimQuery } from '@/queries/useVatsimQuery';

interface VatsimEventsTabProps {
  onSelectAirport: (icao: string) => void;
}

const STATUS_STYLES = {
  live: 'bg-success/20 text-success border-success/30',
  soon: 'bg-warning/20 text-warning border-warning/30',
  upcoming: 'bg-muted text-muted-foreground border-border',
};

const STATUS_LABELS = {
  live: 'LIVE',
  soon: 'SOON',
  upcoming: 'UPCOMING',
};

export function VatsimEventsTab({ onSelectAirport }: VatsimEventsTabProps) {
  const { t } = useTranslation();
  const { data: vatsimData, isLoading: isLoadingVatsim } = useVatsimQuery(true);
  const { data: events, isLoading: isLoadingEvents } = useVatsimEventsQuery();

  const busiestAirports = getBusiestAirports(vatsimData, 5);

  // Sort events: live first, then soon, then upcoming
  const sortedEvents = [...(events || [])]
    .sort((a, b) => {
      const statusOrder = { live: 0, soon: 1, upcoming: 2 };
      return statusOrder[getEventStatus(a)] - statusOrder[getEventStatus(b)];
    })
    .slice(0, 10); // Limit to 10 events

  if (isLoadingVatsim && isLoadingEvents) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Busiest Airports */}
      {busiestAirports.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Plane className="h-3 w-3" />
            {t('explore.vatsim.busiestNow', 'Busiest Now')}
          </h4>
          <div className="space-y-1">
            {busiestAirports.map((airport, index) => (
              <button
                key={airport.icao}
                onClick={() => onSelectAirport(airport.icao)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 text-xs text-muted-foreground">{index + 1}.</span>
                  <span className="font-mono text-sm font-medium">{airport.icao}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-success">↗ {airport.departures}</span>
                  <span className="text-warning">↘ {airport.arrivals}</span>
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {t('explore.vatsim.events', 'Events')}
        </h4>

        {sortedEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('explore.vatsim.noEvents', 'No upcoming events')}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedEvents.map((event) => {
              const status = getEventStatus(event);
              const timeInfo = getEventTimeInfo(event);
              const primaryRoute = event.routes[0];

              return (
                <div key={event.id} className={cn('rounded-lg border p-3', STATUS_STYLES[status])}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('px-1.5 py-0 text-xs', STATUS_STYLES[status])}
                        >
                          {STATUS_LABELS[status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{timeInfo}</span>
                      </div>
                      <h5 className="mt-1 truncate text-sm font-medium">{event.name}</h5>
                    </div>
                  </div>

                  {/* Route */}
                  {primaryRoute && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="font-mono font-medium">{primaryRoute.departure}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono font-medium">{primaryRoute.arrival}</span>
                    </div>
                  )}

                  {/* Actions */}
                  {primaryRoute && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => onSelectAirport(primaryRoute.departure)}
                      >
                        <MapPin className="h-3 w-3" />
                        {t('explore.vatsim.goToDeparture', 'Go to Departure')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VATSIM attribution */}
      <div className="pt-2 text-center">
        <span className="text-xs text-muted-foreground">
          Data from{' '}
          <a
            href="https://vatsim.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            VATSIM
          </a>
        </span>
      </div>
    </div>
  );
}
