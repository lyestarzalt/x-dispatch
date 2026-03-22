import { Plane } from 'lucide-react';
import { FEATURED_ROUTES } from '@/components/layout/Toolbar/ExplorePanel/featured';
import { cn } from '@/lib/utils/helpers';
import type { RoutesTabProps } from './types';

export function RoutesTab({ selectedRoute, onSelectRoute }: RoutesTabProps) {
  const isSelected = (from: string, to: string) =>
    selectedRoute?.from === from && selectedRoute?.to === to;

  const handleClick = (from: string, to: string) => {
    if (isSelected(from, to)) {
      onSelectRoute(null);
    } else {
      onSelectRoute({ from, to });
    }
  };

  return (
    <div className="grid gap-1">
      {FEATURED_ROUTES.map((route) => (
        <button
          key={`${route.from}-${route.to}`}
          onClick={() => handleClick(route.from, route.to)}
          className={cn(
            'flex min-w-0 items-center gap-2 overflow-hidden rounded px-2.5 py-2 text-left transition-colors',
            isSelected(route.from, route.to)
              ? 'bg-primary/10 text-primary'
              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Plane className="h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="xp-value shrink-0 text-info">{route.from}</span>
              <span className="text-xs text-muted-foreground/40">→</span>
              <span className="xp-value shrink-0 text-info">{route.to}</span>
              <span className="truncate text-sm text-foreground">{route.name}</span>
            </div>
            <span className="block truncate text-xs text-muted-foreground">
              {route.description}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
