import type { FeaturedCategory } from '@/data';

export interface FiltersTabProps {
  country: string | null;
  region: string | null;
  type: 'all' | 'land' | 'seaplane' | 'heliport';
  hasIata: boolean;
  onCountryChange: (country: string | null) => void;
  onRegionChange: (region: string | null) => void;
  onTypeChange: (type: 'all' | 'land' | 'seaplane' | 'heliport') => void;
  onHasIataChange: (hasIata: boolean) => void;
}

export interface FeaturedTabProps {
  category: FeaturedCategory | 'all';
  onCategoryChange: (category: FeaturedCategory | 'all') => void;
  onSelectAirport: (icao: string) => void;
}

export interface RoutesTabProps {
  selectedRoute: { from: string; to: string } | null;
  onSelectRoute: (route: { from: string; to: string } | null) => void;
}
