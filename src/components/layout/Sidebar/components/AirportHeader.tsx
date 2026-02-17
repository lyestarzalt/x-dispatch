import { Badge } from '@/components/ui/badge';
import { FlightCategory } from '@/lib/utils/format/metar';
import { useAppStore } from '@/stores/appStore';

interface AirportHeaderProps {
  flightCategory?: FlightCategory | null;
  weatherLine?: string | null;
}

const FLIGHT_CATEGORY_COLORS: Record<FlightCategory, string> = {
  VFR: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  MVFR: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  IFR: 'bg-red-500/15 text-red-400 border-red-500/30',
  LIFR: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
};

export default function AirportHeader({ flightCategory, weatherLine }: AirportHeaderProps) {
  const airport = useAppStore((s) => s.selectedAirportData);

  if (!airport) return null;

  const elevation = Math.round(airport.elevation);
  const runwayCount = airport.runways.length;
  const gateCount = airport.startupLocations?.length || 0;

  return (
    <div className="p-5">
      {/* Identity */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-tight text-foreground">
            {airport.id}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/80">{airport.name}</p>
        </div>
        {flightCategory && (
          <Badge
            variant="outline"
            className={`border px-2.5 py-1 font-mono text-xs font-bold ${FLIGHT_CATEGORY_COLORS[flightCategory]}`}
          >
            {flightCategory}
          </Badge>
        )}
      </div>

      {/* Quick stats - inline, not boxed */}
      <div className="mt-4 flex items-center gap-6 text-sm">
        <div>
          <span className="text-muted-foreground/60">Elev</span>
          <span className="ml-2 font-mono text-foreground">{elevation}'</span>
        </div>
        <div>
          <span className="text-muted-foreground/60">Rwy</span>
          <span className="ml-2 font-mono text-foreground">{runwayCount}</span>
        </div>
        <div>
          <span className="text-muted-foreground/60">Gates</span>
          <span className="ml-2 font-mono text-foreground">{gateCount}</span>
        </div>
      </div>

      {/* Weather - subtle, integrated */}
      {weatherLine && (
        <p className="mt-3 font-mono text-xs text-muted-foreground/70">{weatherLine}</p>
      )}
    </div>
  );
}
