import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useMapStore } from '@/stores/mapStore';
import { FeaturedTab } from './FeaturedTab';
import { RoutesTab } from './RoutesTab';
import { VatsimEventsTab } from './VatsimEventsTab';

const TABS = ['featured', 'routes', 'vatsim'] as const;

interface ExplorePanelProps {
  airports: Airport[];
  onSelectAirport: (airport: Airport) => void;
}

export function ExplorePanel({ airports, onSelectAirport }: ExplorePanelProps) {
  const { t } = useTranslation();
  const explore = useMapStore((s) => s.explore);
  const setExploreTab = useMapStore((s) => s.setExploreTab);
  const setExploreOpen = useMapStore((s) => s.setExploreOpen);
  const setFeaturedCategory = useMapStore((s) => s.setFeaturedCategory);
  const setSelectedRoute = useMapStore((s) => s.setSelectedRoute);

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
      className="absolute left-4 top-44 z-10 w-[340px] rounded-lg border border-border bg-card"
    >
      <div role="tablist" aria-label={t('explore.title')} className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={explore.activeTab === tab}
            aria-controls={`explore-tabpanel-${tab}`}
            onClick={() => setExploreTab(tab)}
            className={cn(
              'flex-1 px-4 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors',
              explore.activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`explore.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`explore-tabpanel-${explore.activeTab}`}
        aria-labelledby={explore.activeTab}
        className="max-h-96 overflow-y-auto overflow-x-hidden p-4"
      >
        {explore.activeTab === 'featured' && (
          <FeaturedTab
            category={explore.featuredCategory}
            onCategoryChange={setFeaturedCategory}
            onSelectAirport={handleSelectAirport}
          />
        )}
        {explore.activeTab === 'routes' && (
          <RoutesTab selectedRoute={explore.selectedRoute} onSelectRoute={setSelectedRoute} />
        )}
        {explore.activeTab === 'vatsim' && (
          <VatsimEventsTab onSelectAirport={handleSelectAirport} />
        )}
      </div>
    </div>
  );
}
