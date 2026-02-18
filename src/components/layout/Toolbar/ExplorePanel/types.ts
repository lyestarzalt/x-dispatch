import type { FeaturedCategory } from '@/types/featured';

export interface FeaturedTabProps {
  category: FeaturedCategory | 'all';
  onCategoryChange: (category: FeaturedCategory | 'all') => void;
  onSelectAirport: (icao: string) => void;
}

export interface RoutesTabProps {
  selectedRoute: { from: string; to: string } | null;
  onSelectRoute: (route: { from: string; to: string } | null) => void;
}
