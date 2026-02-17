import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Clock, MapPin, ParkingCircle, Plane, Rocket, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTransitionAltitude } from '@/lib/utils/format';
import { FlightCategory } from '@/lib/utils/format/metar';
import { runwayLengthFeet } from '@/lib/utils/geomath';
import { useAirportMetadata } from '@/queries';
import type { ParsedAirport } from '@/types/apt';

interface AirportHeaderProps {
  airport: ParsedAirport;
  flightCategory?: FlightCategory | null;
  onClose?: () => void;
  selectedStartPosition?: { type: 'runway' | 'ramp'; name: string } | null;
}

const FLIGHT_CATEGORY_VARIANTS: Record<FlightCategory, 'success' | 'info' | 'danger' | 'violet'> = {
  VFR: 'success',
  MVFR: 'info',
  IFR: 'danger',
  LIFR: 'violet',
};

export default function AirportHeader({
  airport,
  flightCategory,
  onClose,
  selectedStartPosition,
}: AirportHeaderProps) {
  const { t } = useTranslation();
  const { data: metadata } = useAirportMetadata(airport.id);

  // Calculate local time from airport position
  const rwy = airport.runways[0];
  const lon = rwy ? (rwy.ends[0].longitude + rwy.ends[1].longitude) / 2 : 0;
  const tzOffset = Math.round(lon / 15);
  const localTime = new Date();
  localTime.setHours(localTime.getUTCHours() + tzOffset);
  const timeStr = localTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tzStr = tzOffset >= 0 ? `UTC+${tzOffset}` : `UTC${tzOffset}`;

  // Calculate longest runway from airport data (in feet)
  const longestRunwayFt = useMemo(() => {
    if (metadata?.longestRunway) return metadata.longestRunway;
    if (!airport.runways.length) return 0;
    return Math.max(...airport.runways.map((r) => runwayLengthFeet(r.ends[0], r.ends[1])));
  }, [airport.runways, metadata?.longestRunway]);

  const gatesCount = airport.startupLocations?.length || 0;
  const runwaysCount = airport.runways.length;

  return (
    <div className="border-b border-border p-4">
      {/* Top row: ICAO + Badge + Close button */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-info" />
            <h2 className="xp-detail-heading font-mono">{airport.id}</h2>
            {flightCategory && (
              <Badge
                variant={FLIGHT_CATEGORY_VARIANTS[flightCategory]}
                className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
              >
                {flightCategory}
              </Badge>
            )}
            {metadata?.transitionAlt && (
              <Badge
                variant="outline"
                className="rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                title={t('sidebar.transitionAltitude')}
              >
                TA {formatTransitionAltitude(metadata.transitionAlt)}
              </Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{airport.name}</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Location row */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>
          {airport.metadata.city || '--'}, {airport.metadata.country || '--'}
        </span>
      </div>

      {/* Stats grid */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <div className="min-w-0 rounded-lg bg-secondary px-1.5 py-1.5 text-center">
          <div className="xp-label">ELEV</div>
          <div className="truncate font-mono text-xs text-foreground">
            {Math.round(airport.elevation)}ft
          </div>
        </div>
        <div className="min-w-0 rounded-lg bg-secondary px-1.5 py-1.5 text-center">
          <div className="xp-label flex items-center justify-center gap-0.5">
            <ArrowUpRight className="h-2.5 w-2.5" />
            RWY
          </div>
          <div className="truncate font-mono text-xs text-foreground">{runwaysCount}</div>
        </div>
        <div className="min-w-0 rounded-lg bg-secondary px-1.5 py-1.5 text-center">
          <div className="xp-label flex items-center justify-center gap-0.5">
            <ParkingCircle className="h-2.5 w-2.5" />
            GATES
          </div>
          <div className="truncate font-mono text-xs text-foreground">{gatesCount}</div>
        </div>
        <div className="min-w-0 rounded-lg bg-secondary px-1.5 py-1.5 text-center">
          <div className="xp-label">MAX</div>
          <div className="truncate font-mono text-xs text-foreground">
            {Math.round(longestRunwayFt)}ft
          </div>
        </div>
      </div>

      {/* Time row */}
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span className="font-mono text-foreground">{timeStr}</span>
        <span className="opacity-60">{tzStr}</span>
      </div>

      {/* Selected Start Position */}
      {selectedStartPosition && (
        <Alert variant="success" className="mt-3 p-2">
          <AlertDescription className="flex items-center gap-2">
            <Rocket className="h-3.5 w-3.5" />
            <span className="text-xs">{t('launcher.config.departure')}:</span>
            <span className="truncate text-xs font-medium text-foreground">
              {selectedStartPosition.name}
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
