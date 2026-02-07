import { Plane } from 'lucide-react';
import { FEATURED_ROUTES } from '@/data';
import { cn } from '@/lib/utils';
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
    <div className="grid gap-2">
      {FEATURED_ROUTES.map((route) => (
        <button
          key={`${route.from}-${route.to}`}
          onClick={() => handleClick(route.from, route.to)}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
            isSelected(route.from, route.to)
              ? 'border-primary bg-primary/10'
              : 'border-border bg-background hover:bg-muted'
          )}
        >
          <Plane className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{route.from}</span>
              <span className="text-muted-foreground">-</span>
              <span className="font-mono text-sm font-medium">{route.to}</span>
            </div>
            <div className="mt-1 text-sm text-foreground">{route.name}</div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{route.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
