import { ArrowRight } from 'lucide-react';
import { IcaoCode } from '@/components/ui/icao-code';
import { FEATURED_ROUTES } from './featured/featuredRoutes';
import type { RoutesTabProps } from './types';

export function RoutesTab({ onPlanRoute }: RoutesTabProps) {
  return (
    <div className="space-y-0.5">
      {FEATURED_ROUTES.map((route) => (
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
