import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { IcaoCode } from '@/components/ui/icao-code';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { FEATURED_ROUTES } from './featuredRoutes';

interface RoutesTabProps {
  airports: Airport[];
  /** A city pair was picked: it becomes the plan's departure and arrival. */
  onPlanRoute: (from: string, to: string) => void;
}

export function RoutesTab({ airports, onPlanRoute }: RoutesTabProps) {
  // Only routes the user can actually fly: both ends must be in X-Plane's database.
  const routes = useMemo(() => {
    const known = new Set(airports.map((a) => a.icao));
    return FEATURED_ROUTES.filter((route) => known.has(route.from) && known.has(route.to));
  }, [airports]);

  return (
    <div className="space-y-0.5">
      {routes.map((route) => (
        <button
          key={`${route.from}-${route.to}`}
          onClick={() => onPlanRoute(route.from, route.to)}
          className="group hover:bg-muted/50 flex w-full min-w-0 items-baseline gap-2 overflow-hidden rounded px-2 py-1.5 text-left transition-colors"
        >
          <IcaoCode className="text-info shrink-0 text-sm">{route.from}</IcaoCode>
          <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 self-center" />
          <IcaoCode className="text-info shrink-0 text-sm">{route.to}</IcaoCode>
          <span className="xp-label min-w-0 truncate">{route.name}</span>
        </button>
      ))}
    </div>
  );
}
