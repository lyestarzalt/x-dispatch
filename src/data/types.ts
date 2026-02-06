// src/data/types.ts

export type FeaturedCategory = 'challenging' | 'scenic' | 'unique' | 'historic';

export interface FeaturedAirport {
  icao: string;
  category: FeaturedCategory;
  tagline: string;
  description: string;
}

export interface FeaturedRoute {
  from: string;
  to: string;
  name: string;
  description: string;
}
