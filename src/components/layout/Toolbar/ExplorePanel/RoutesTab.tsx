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
    <div className="space-y-0.5">
      {FEATURED_ROUTES.map((route) => {
        const active = isSelected(route.from, route.to);
        return (
          <button
            key={`${route.from}-${route.to}`}
            onClick={() => handleClick(route.from, route.to)}
            className={cn(
              'group flex w-full min-w-0 items-baseline gap-2 overflow-hidden rounded px-2 py-1.5 text-left transition-colors',
              active ? 'bg-primary/10' : 'hover:bg-muted/50'
            )}
          >
            <span
              className={cn(
                'shrink-0 font-mono text-sm font-semibold',
                active ? 'text-primary' : 'text-info'
              )}
            >
              {route.from}
            </span>
            <span className="text-xs text-muted-foreground/40">→</span>
            <span
              className={cn(
                'shrink-0 font-mono text-sm font-semibold',
                active ? 'text-primary' : 'text-info'
              )}
            >
              {route.to}
            </span>
            <span className="xp-label min-w-0 truncate">{route.name}</span>
          </button>
        );
      })}
    </div>
  );
}
