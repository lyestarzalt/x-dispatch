import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useMapStore } from '@/stores/mapStore';
import { FeaturedTab } from './FeaturedTab';
import { FiltersTab } from './FiltersTab';
import { RoutesTab } from './RoutesTab';

const TABS = ['filters', 'featured', 'routes'] as const;

export function ExplorePanel() {
  const { t } = useTranslation();
  const explore = useMapStore((s) => s.explore);
  const setExploreTab = useMapStore((s) => s.setExploreTab);
  const setExploreFilters = useMapStore((s) => s.setExploreFilters);
  const setFeaturedCategory = useMapStore((s) => s.setFeaturedCategory);
  const setSelectedRoute = useMapStore((s) => s.setSelectedRoute);

  if (!explore.isOpen) return null;

  const handleSelectAirport = (icao: string) => {
    console.log('Select airport:', icao);
    // Will be implemented to fly to airport
  };

  return (
    <div className="absolute left-0 right-0 top-full z-40 border-b border-border bg-card shadow-lg">
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setExploreTab(tab)}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              explore.activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`explore.tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto p-4">
        {explore.activeTab === 'filters' && (
          <FiltersTab
            country={explore.filters.country}
            region={explore.filters.region}
            type={explore.filters.type}
            hasIata={explore.filters.hasIata}
            onCountryChange={(country) => setExploreFilters({ country })}
            onRegionChange={(region) => setExploreFilters({ region })}
            onTypeChange={(type) => setExploreFilters({ type })}
            onHasIataChange={(hasIata) => setExploreFilters({ hasIata })}
          />
        )}
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
      </div>
    </div>
  );
}

export { FiltersTab } from './FiltersTab';
export { FeaturedTab } from './FeaturedTab';
export { RoutesTab } from './RoutesTab';
export type * from './types';
