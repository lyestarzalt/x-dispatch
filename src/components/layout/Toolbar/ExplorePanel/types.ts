import type { Airport } from '@/lib/xplaneServices/dataService';
import type { FeaturedCategory } from '@/types/featured';

export interface FeaturedTabProps {
  category: FeaturedCategory | 'all';
  onCategoryChange: (category: FeaturedCategory | 'all') => void;
  onSelectAirport: (icao: string) => void;
}

export interface RoutesTabProps {
  airports: Airport[];
  selectedRoute: { from: string; to: string } | null;
  onSelectRoute: (route: { from: string; to: string } | null) => void;
}
