import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { FEATURED_ROUTES } from '@/components/layout/Toolbar/ExplorePanel/featured';
import { IcaoCode } from '@/components/ui/icao-code';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import { trackEvent } from '@/queries';
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
      trackEvent('explore_item_selected', { tab: 'routes' });
    }
  };

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        size="xs"
        variant="outline"
        value={mode}
        onValueChange={(v) => v && setMode(v as RoutesMode)}
        className="w-full"
      >
        {MODES.map((m) => (
          <ToggleGroupItem key={m} value={m} className="min-w-0 flex-1">
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
                <IcaoCode className={cn('shrink-0 text-sm', active ? 'text-primary' : 'text-info')}>
                  {route.from}
                </IcaoCode>
                <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 self-center" />
                <IcaoCode className={cn('shrink-0 text-sm', active ? 'text-primary' : 'text-info')}>
                  {route.to}
                </IcaoCode>
                <span className="xp-label min-w-0 truncate">{route.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
