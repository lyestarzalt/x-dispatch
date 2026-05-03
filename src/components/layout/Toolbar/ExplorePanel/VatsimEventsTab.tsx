import { useTranslation } from 'react-i18next';
import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getEventStatus,
  getEventTimeInfo,
  useVatsimEventsQuery,
} from '@/queries/useVatsimEventsQuery';
import { getBusiestAirports, useVatsimQuery } from '@/queries/useVatsimQuery';

interface VatsimEventsTabProps {
  onSelectAirport: (icao: string) => void;
}

const STATUS_VARIANT: Record<string, NonNullable<React.ComponentProps<typeof Badge>['variant']>> = {
  live: 'success',
  soon: 'warning',
  upcoming: 'secondary',
};

export function VatsimEventsTab({ onSelectAirport }: VatsimEventsTabProps) {
  const { t } = useTranslation();
  const { data: vatsimData, isLoading: isLoadingVatsim } = useVatsimQuery(true);
  const { data: events, isLoading: isLoadingEvents } = useVatsimEventsQuery();

  const busiestAirports = getBusiestAirports(vatsimData, 5);

  const sortedEvents = [...(events || [])]
    .sort((a, b) => {
      const statusOrder = { live: 0, soon: 1, upcoming: 2 };
      return statusOrder[getEventStatus(a)] - statusOrder[getEventStatus(b)];
    })
    .slice(0, 10);

  if (isLoadingVatsim && isLoadingEvents) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="xp-label">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Busiest Airports */}
      {busiestAirports.length > 0 && (
        <div>
          <h4 className="xp-section-heading mb-2">
            {t('explore.vatsim.busiestNow', 'Busiest Now')}
          </h4>
          <div className="space-y-0.5">
            {busiestAirports.map((airport, index) => (
              <button
                key={airport.icao}
                onClick={() => onSelectAirport(airport.icao)}
                className="group flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="w-4 font-mono text-xs text-muted-foreground">{index + 1}</span>
                <span className="shrink-0 font-mono text-sm font-semibold text-info">
                  {airport.icao}
                </span>
                <span className="flex-1" />
                <span
                  className="flex items-center gap-1 font-mono text-xs text-success"
                  title={t('explore.vatsim.departures', 'Departures')}
                >
                  <PlaneTakeoff className="h-3 w-3" />
                  {airport.departures}
                </span>
                <span
                  className="flex items-center gap-1 font-mono text-xs text-warning"
                  title={t('explore.vatsim.arrivals', 'Arrivals')}
                >
                  <PlaneLanding className="h-3 w-3" />
                  {airport.arrivals}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      <div>
        <h4 className="xp-section-heading mb-2">{t('explore.vatsim.events', 'Events')}</h4>

        {sortedEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {t('explore.vatsim.noEvents', 'No upcoming events')}
          </p>
        ) : (
          <div className="space-y-0.5">
            {sortedEvents.map((event) => {
              const status = getEventStatus(event);
              const timeInfo = getEventTimeInfo(event);
              const primaryRoute = event.routes[0];

              return (
                <button
                  key={event.id}
                  onClick={() => primaryRoute && onSelectAirport(primaryRoute.departure)}
                  disabled={!primaryRoute}
                  className="block w-full overflow-hidden rounded px-2 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={STATUS_VARIANT[status]}
                      className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px]"
                    >
                      {status.toUpperCase()}
                    </Badge>
                    <span className="line-clamp-2 text-sm leading-snug text-foreground">
                      {event.name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-[3.25rem]">
                    {primaryRoute && (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-info">
                        {primaryRoute.departure}
                        <span className="text-muted-foreground/40">→</span>
                        {primaryRoute.arrival}
                      </span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">{timeInfo}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="pt-1 text-center">
        <span className="text-xs text-muted-foreground/50">
          Data from{' '}
          <a
            href="https://vatsim.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/70 hover:text-primary"
          >
            VATSIM
          </a>
        </span>
      </div>
    </div>
  );
}
