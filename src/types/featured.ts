/**
 * Featured Types - Types for featured airports and routes
 * Curated content for the explore panel
 */

// ============================================================================
// Featured Category
// ============================================================================

export type FeaturedCategory = 'challenging' | 'scenic' | 'unique' | 'historic';

// ============================================================================
// Featured Airport
// ============================================================================

export interface FeaturedAirport {
  icao: string;
  category: FeaturedCategory;
  tagline: string;
  description: string;
}

// ============================================================================
// Featured Route
// ============================================================================

export interface FeaturedRoute {
  from: string;
  to: string;
  name: string;
  description: string;
}
