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
  showPlaneTracker: boolean;
  /** When true, map follows plane position and heading */
  followPlane: boolean;
  explore: ExploreState;
  /** Incremented when map style changes to trigger layer re-adds */
  styleVersion: number;

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
  setShowPlaneTracker: (enabled: boolean) => void;
  setFollowPlane: (enabled: boolean) => void;
  resetLayerVisibility: () => void;

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
      showPlaneTracker: false,
      followPlane: false,
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
      setVatsimEnabled: (enabled) => set({ vatsimEnabled: enabled }),
      setShowPlaneTracker: (enabled) => set({ showPlaneTracker: enabled }),
      setFollowPlane: (enabled) => set({ followPlane: enabled }),
      resetLayerVisibility: () =>
        set({
          layerVisibility: DEFAULT_LAYER_VISIBILITY,
          navVisibility: DEFAULT_NAV_VISIBILITY,
        }),

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
      version: 2,
      partialize: (state) => ({
        layerVisibility: state.layerVisibility,
        navVisibility: state.navVisibility,
        isNightMode: state.isNightMode,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        // Migration from v1 to v2: consolidate navVisibility
        if (version === 1) {
          const oldNav = state.navVisibility as Record<string, unknown> | undefined;
          if (oldNav) {
            // Convert old separate vors/ndbs/dmes to consolidated navaids
            const hadNavaids = oldNav.vors || oldNav.ndbs || oldNav.dmes;
            state.navVisibility = {
              navaids: hadNavaids ?? true,
              ils: oldNav.ils ?? true,
              airspaces: oldNav.airspaces ?? true,
              airwaysMode: oldNav.airwaysMode ?? 'off',
            };
          }
        }
        return state;
      },
    }
  )
);
