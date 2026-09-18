import { useTranslation } from 'react-i18next';
import { ArrowRight, Plane, PlaneLanding } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RATING_TEXT_CLASS, formatDateTime, formatDuration } from '@/lib/flightRecorder/format';
import { cn } from '@/lib/utils/helpers';
import type { FlightSummary } from '@/types/flightRecorder';
import { TrailThumbnail } from './TrailThumbnail';

interface FlightListProps {
  flights: FlightSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FlightList({ flights, selectedId, onSelect }: FlightListProps) {
  return (
    <div className="flex flex-col gap-1.5 p-3">
      {flights.map((flight) => (
        <FlightCard
          key={flight.id}
          flight={flight}
          selected={flight.id === selectedId}
          onSelect={() => onSelect(flight.id)}
        />
      ))}
    </div>
  );
}

interface FlightCardProps {
  flight: FlightSummary;
  selected: boolean;
  onSelect: () => void;
}

function FlightCard({ flight, selected, onSelect }: FlightCardProps) {
  const { t, i18n } = useTranslation();
  const landing = flight.landing;
  const aircraftLabel =
    flight.aircraft.icao ?? flight.aircraft.name ?? t('logbook.unknownAircraft');

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-primary/60 bg-primary/10'
          : 'border-border/50 bg-card/80 hover:border-primary/30 hover:bg-card'
      )}
    >
      <TrailThumbnail preview={flight.preview} width={72} height={44} className="text-sky-300" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-mono text-sm font-semibold">
          <span>{flight.departure?.icao ?? '----'}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span>{flight.arrival?.icao ?? '----'}</span>
          {flight.status === 'active' && (
            <Badge variant="success" className="ml-1 px-1.5 py-0 text-[10px]">
              {t('logbook.active')}
            </Badge>
          )}
          {flight.status === 'aborted' && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {t('logbook.aborted')}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <Plane className="h-3 w-3" />
          <span className="truncate">{aircraftLabel}</span>
          <span className="text-border">·</span>
          <span className="font-mono">{formatDuration(flight.blockTimeSec)}</span>
          <span className="text-border">·</span>
          <span className="font-mono">
            {Math.round(flight.distanceNm)} {t('units.nm')}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground/60">
          {formatDateTime(flight.startedAt, i18n.language)}
        </div>
      </div>
      {landing && (
        <div className={cn('flex flex-col items-end', RATING_TEXT_CLASS[landing.rating])}>
          <div className="flex items-center gap-1 font-mono text-sm font-bold">
            <PlaneLanding className="h-3.5 w-3.5" />
            {landing.touchdownRateFpm}
          </div>
          <span className="text-[10px] uppercase tracking-wide opacity-80">
            {t(`landing.rating.${landing.rating}`)}
          </span>
        </div>
      )}
    </button>
  );
}
