import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useMapStore } from '@/stores/mapStore';
import { FeaturedTab } from './FeaturedTab';
import { RoutesTab } from './RoutesTab';
import { VatsimEventsTab } from './VatsimEventsTab';
import { WeatherTab } from './WeatherTab';

const TABS = ['featured', 'routes', 'vatsim', 'weather'] as const;

interface ExplorePanelProps {
  airports: Airport[];
  onSelectAirport: (airport: Airport) => void;
}

function ExplorePanelComponent({ airports, onSelectAirport }: ExplorePanelProps) {
  const { t } = useTranslation();
  const explore = useMapStore((s) => s.explore);
  const setExploreTab = useMapStore((s) => s.setExploreTab);
  const setExploreOpen = useMapStore((s) => s.setExploreOpen);
  const setFeaturedCategory = useMapStore((s) => s.setFeaturedCategory);
  const setSelectedRoute = useMapStore((s) => s.setSelectedRoute);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSelectAirport = useCallback(
    (icao: string) => {
      const airport = airports.find((a) => a.icao === icao);
      if (airport) {
        onSelectAirport(airport);
        setExploreOpen(false);
      }
    },
    [airports, onSelectAirport, setExploreOpen]
  );

  if (!explore.isOpen) return null;

  return (
    <div
      id="explore-panel"
      className={cn(
        'absolute top-16 bottom-4 left-4 z-10 transition-all duration-300 ease-out',
        isCollapsed ? 'w-12' : 'w-80'
      )}
    >
      <div className="border-border/40 bg-card/95 relative flex h-full flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm">
        {/* Collapsed state */}
        <div
          className={cn(
            'bg-card/95 absolute inset-0 z-20 flex flex-col items-center py-5 transition-opacity duration-200',
            isCollapsed ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="mb-4 h-8 w-8"
            onClick={() => setIsCollapsed(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span
            className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
            style={{ writingMode: 'vertical-rl' }}
          >
            {t('explore.title')}
          </span>
        </div>

        {/* Close / Collapse buttons */}
        <div
          className={cn(
            'absolute top-2 right-2 z-10 flex items-center gap-0.5',
            isCollapsed && 'pointer-events-none opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/40 hover:text-foreground h-7 w-7"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/40 hover:text-foreground h-7 w-7"
            onClick={() => setExploreOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Header */}
        <div
          className={cn(
            'border-border/30 flex shrink-0 items-center gap-2 border-b px-4 py-3',
            isCollapsed && 'opacity-0'
          )}
        >
          <Compass className="text-primary h-4 w-4" />
          <span className="text-sm font-medium">{t('explore.title')}</span>
        </div>

        {/* Tabs */}
        <Tabs
          value={explore.activeTab}
          onValueChange={(v) => setExploreTab(v as (typeof TABS)[number])}
          className={cn('flex min-h-0 flex-1 flex-col', isCollapsed && 'opacity-0')}
        >
          <TabsList variant="line" className="shrink-0 px-2">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex-1 text-xs tracking-wide uppercase">
                {t(`explore.tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="p-4">
              <TabsContent value="featured" className="mt-0">
                <FeaturedTab
                  category={explore.featuredCategory}
                  onCategoryChange={setFeaturedCategory}
                  onSelectAirport={handleSelectAirport}
                />
              </TabsContent>
              <TabsContent value="routes" className="mt-0">
                <RoutesTab selectedRoute={explore.selectedRoute} onSelectRoute={setSelectedRoute} />
              </TabsContent>
              <TabsContent value="vatsim" className="mt-0">
                <VatsimEventsTab onSelectAirport={handleSelectAirport} />
              </TabsContent>
              <TabsContent value="weather" className="mt-0">
                <WeatherTab airports={airports} onSelectAirport={handleSelectAirport} />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export const ExplorePanel = memo(ExplorePanelComponent);
