import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeaturedCategory } from '@/types/featured';
import {
  AirwaysMode,
  DEFAULT_LAYER_VISIBILITY,
  DEFAULT_NAV_VISIBILITY,
  LayerVisibility,
  NavLayerVisibility,
} from '@/types/layers';

export interface FeatureDebugInfo {
  type: 'line' | 'sign' | 'gate' | 'runway' | 'taxiway' | 'unknown';
  name?: string;
  properties: Record<string, unknown>;
  coordinates?: [number, number] | [number, number][];
  rawData?: string;
}

export type SurfaceTypeFilter = 'paved' | 'unpaved' | 'water' | 'other';

export interface AirportFilterState {
  showLand: boolean;
  showSeaplane: boolean;
  showHeliport: boolean;
  onlyCustom: boolean;
  surfaceTypes: SurfaceTypeFilter[];
  country: string; // 'all' = no filter
}

export const ALL_SURFACE_TYPES: SurfaceTypeFilter[] = ['paved', 'unpaved', 'water', 'other'];

export const DEFAULT_AIRPORT_FILTERS: AirportFilterState = {
  showLand: true,
  showSeaplane: true,
  showHeliport: true,
  onlyCustom: false,
  surfaceTypes: [...ALL_SURFACE_TYPES],
  country: 'all',
};

export interface ExploreFilters {
  country: string | null;
  region: string | null;
  type: 'all' | 'land' | 'seaplane' | 'heliport';
  hasIata: boolean;
}

export type ExploreTab = 'featured' | 'routes' | 'vatsim';
/** Filter variant includes 'all' option for UI */
export type FeaturedCategoryFilter = 'all' | FeaturedCategory;

export interface ExploreState {
  isOpen: boolean;
  activeTab: ExploreTab;
  selectedRoute: { from: string; to: string } | null;
  filters: ExploreFilters;
  featuredCategory: FeaturedCategoryFilter;
}

interface MapState {
  layerVisibility: LayerVisibility;
  navVisibility: NavLayerVisibility;
  isNightMode: boolean;
  currentZoom: number;
  mapBearing: number;
  debugEnabled: boolean;
  selectedFeature: FeatureDebugInfo | null;
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;
  showPlaneTracker: boolean;
  /** When true, map follows plane position and heading */
  followPlane: boolean;
  weatherRadarEnabled: boolean;
  explore: ExploreState;
  /** Incremented when map style changes to trigger layer re-adds */
  styleVersion: number;
  airportFilters: AirportFilterState;

  setLayerVisibility: (visibility: Partial<LayerVisibility>) => void;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  setNavVisibility: (visibility: Partial<NavLayerVisibility>) => void;
  toggleNavLayer: (layer: keyof NavLayerVisibility) => void;
  setAirwaysMode: (mode: AirwaysMode) => void;
  setIsNightMode: (isNight: boolean) => void;
  toggleNightMode: () => void;
  setCurrentZoom: (zoom: number) => void;
  setMapBearing: (bearing: number) => void;
  setDebugEnabled: (enabled: boolean) => void;
  setSelectedFeature: (feature: FeatureDebugInfo | null) => void;
  setVatsimEnabled: (enabled: boolean) => void;
  setIvaoEnabled: (enabled: boolean) => void;
  setShowPlaneTracker: (enabled: boolean) => void;
  setFollowPlane: (enabled: boolean) => void;
  setWeatherRadarEnabled: (enabled: boolean) => void;
  resetLayerVisibility: () => void;
  setAirportFilters: (filters: Partial<AirportFilterState>) => void;
  resetAirportFilters: () => void;

  setExploreOpen: (isOpen: boolean) => void;
  setExploreTab: (tab: ExploreTab) => void;
  setSelectedRoute: (route: { from: string; to: string } | null) => void;
  setExploreFilters: (filters: Partial<ExploreFilters>) => void;
  setFeaturedCategory: (category: FeaturedCategoryFilter) => void;
  incrementStyleVersion: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      layerVisibility: DEFAULT_LAYER_VISIBILITY,
      navVisibility: DEFAULT_NAV_VISIBILITY,
      isNightMode: false,
      currentZoom: 2,
      mapBearing: 0,
      debugEnabled: false,
      selectedFeature: null as FeatureDebugInfo | null,
      vatsimEnabled: false,
      ivaoEnabled: false,
      showPlaneTracker: false,
      followPlane: false,
      weatherRadarEnabled: false,
      explore: {
        isOpen: false,
        activeTab: 'featured' as ExploreTab,
        selectedRoute: null as { from: string; to: string } | null,
        filters: {
          country: null as string | null,
          region: null as string | null,
          type: 'all' as ExploreFilters['type'],
          hasIata: false,
        },
        featuredCategory: 'all' as FeaturedCategoryFilter,
      },
      styleVersion: 0,
      airportFilters: DEFAULT_AIRPORT_FILTERS,

      setLayerVisibility: (visibility) =>
        set((state) => ({
          layerVisibility: { ...state.layerVisibility, ...visibility },
        })),

      toggleLayer: (layer) =>
        set((state) => ({
          layerVisibility: {
            ...state.layerVisibility,
            [layer]: !state.layerVisibility[layer],
          },
        })),

      setNavVisibility: (visibility) =>
        set((state) => ({
          navVisibility: { ...state.navVisibility, ...visibility },
        })),

      toggleNavLayer: (layer) =>
        set((state) => ({
          navVisibility: {
            ...state.navVisibility,
            [layer]: !state.navVisibility[layer],
          },
        })),

      setAirwaysMode: (mode) =>
        set((state) => ({
          navVisibility: {
            ...state.navVisibility,
            airwaysMode: mode,
          },
        })),

      setIsNightMode: (isNight) => set({ isNightMode: isNight }),
      toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
      setCurrentZoom: (zoom) => set({ currentZoom: zoom }),
      setMapBearing: (bearing) => set({ mapBearing: bearing }),
      setDebugEnabled: (enabled) => set({ debugEnabled: enabled }),
      setSelectedFeature: (feature) => set({ selectedFeature: feature }),
      setVatsimEnabled: (enabled) =>
        set((state) => ({
          vatsimEnabled: enabled,
          ...(enabled && state.ivaoEnabled ? { ivaoEnabled: false } : {}),
        })),
      setIvaoEnabled: (enabled) =>
        set((state) => ({
          ivaoEnabled: enabled,
          ...(enabled && state.vatsimEnabled ? { vatsimEnabled: false } : {}),
        })),
      setShowPlaneTracker: (enabled) => set({ showPlaneTracker: enabled }),
      setFollowPlane: (enabled) => set({ followPlane: enabled }),
      setWeatherRadarEnabled: (enabled) => set({ weatherRadarEnabled: enabled }),
      resetLayerVisibility: () =>
        set({
          layerVisibility: DEFAULT_LAYER_VISIBILITY,
          navVisibility: DEFAULT_NAV_VISIBILITY,
        }),

      setAirportFilters: (filters) =>
        set((state) => ({
          airportFilters: { ...state.airportFilters, ...filters },
        })),

      resetAirportFilters: () => set({ airportFilters: DEFAULT_AIRPORT_FILTERS }),

      setExploreOpen: (isOpen) => set((state) => ({ explore: { ...state.explore, isOpen } })),
      setExploreTab: (tab) => set((state) => ({ explore: { ...state.explore, activeTab: tab } })),
      setSelectedRoute: (route) =>
        set((state) => ({ explore: { ...state.explore, selectedRoute: route } })),
      setExploreFilters: (filters) =>
        set((state) => ({
          explore: { ...state.explore, filters: { ...state.explore.filters, ...filters } },
        })),
      setFeaturedCategory: (category) =>
        set((state) => ({ explore: { ...state.explore, featuredCategory: category } })),
      incrementStyleVersion: () => set((state) => ({ styleVersion: state.styleVersion + 1 })),
    }),
    {
      name: 'xplane-viz-map',
      version: 6,
      partialize: (state) => ({
        layerVisibility: state.layerVisibility,
        navVisibility: state.navVisibility,
        isNightMode: state.isNightMode,
        airportFilters: state.airportFilters,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        // Migration from v1 to v2: consolidate navVisibility
        if (version === 1) {
          const oldNav = state.navVisibility as Record<string, unknown> | undefined;
          if (oldNav) {
            const hadNavaids = oldNav.vors || oldNav.ndbs || oldNav.dmes;
            state.navVisibility = {
              navaids: hadNavaids ?? true,
              ils: oldNav.ils ?? true,
              airspaces: oldNav.airspaces ?? true,
              airwaysMode: oldNav.airwaysMode ?? 'off',
            };
          }
        }
        // Migration to v3+: add airportFilters
        if (version < 3) {
          state.airportFilters = DEFAULT_AIRPORT_FILTERS;
        }
        // Migration to v4: remove deprecated filter keys, reset to clean state
        if (version < 4) {
          const old = state.airportFilters as Record<string, unknown> | undefined;
          if (old) {
            delete old.onlyWithIata;
            delete old.showPaved;
            delete old.showUnpaved;
            delete old.minRunways;
          }
          state.airportFilters = { ...DEFAULT_AIRPORT_FILTERS, ...old };
        }
        // Migration to v6: add surfaceTypes and country to airport filters
        if (version < 6) {
          const old = state.airportFilters as Record<string, unknown> | undefined;
          if (old) {
            if (!old.surfaceTypes) old.surfaceTypes = [...ALL_SURFACE_TYPES];
            if (!old.country) old.country = 'all';
          }
          state.airportFilters = { ...DEFAULT_AIRPORT_FILTERS, ...old };
        }
        return state;
      },
    }
  )
);
