import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FEATURED_ROUTES } from '@/components/layout/Toolbar/ExplorePanel/featured';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import { RandomRouteFinder } from './RandomRouteFinder';
import type { RoutesTabProps } from './types';

const MODES = ['featured', 'random'] as const;
type RoutesMode = (typeof MODES)[number];

export function RoutesTab({ airports, selectedRoute, onSelectRoute }: RoutesTabProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<RoutesMode>('featured');
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
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={mode}
        onValueChange={(v) => v && setMode(v as RoutesMode)}
        className="w-full"
      >
        {MODES.map((m) => (
          <ToggleGroupItem key={m} value={m} className="h-7 min-w-0 flex-1 px-2 text-xs">
            <span className="truncate">{t(`explorePanel.routes.mode.${m}`)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {mode === 'random' ? (
        <RandomRouteFinder
          airports={airports}
          selectedRoute={selectedRoute}
          onSelectRoute={onSelectRoute}
        />
      ) : (
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
                <span className="text-muted-foreground/40 text-xs">
                  {t('explorePanel.routes.arrow')}
                </span>
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
      )}
    </div>
  );
}
