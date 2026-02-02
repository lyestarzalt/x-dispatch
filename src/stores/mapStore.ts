import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

interface MapState {
  // Layer visibility
  layerVisibility: LayerVisibility;
  navVisibility: NavLayerVisibility;

  // Map state
  isNightMode: boolean;
  currentZoom: number;
  mapBearing: number;

  // Debug mode
  debugEnabled: boolean;
  selectedFeature: FeatureDebugInfo | null;

  // VATSIM
  vatsimEnabled: boolean;

  // Actions
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
  resetLayerVisibility: () => void;
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      // Initial state
      layerVisibility: DEFAULT_LAYER_VISIBILITY,
      navVisibility: DEFAULT_NAV_VISIBILITY,
      isNightMode: false,
      currentZoom: 2,
      mapBearing: 0,
      debugEnabled: false,
      selectedFeature: null as FeatureDebugInfo | null,
      vatsimEnabled: false,

      // Actions
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
      resetLayerVisibility: () =>
        set({
          layerVisibility: DEFAULT_LAYER_VISIBILITY,
          navVisibility: DEFAULT_NAV_VISIBILITY,
        }),
    }),
    {
      name: 'xplane-viz-map',
      version: 1,
      partialize: (state) => ({
        layerVisibility: state.layerVisibility,
        navVisibility: state.navVisibility,
        isNightMode: state.isNightMode,
      }),
    }
  )
);

// Selectors
const selectLayerVisibility = (state: MapState) => state.layerVisibility;
const selectNavVisibility = (state: MapState) => state.navVisibility;
const selectIsNightMode = (state: MapState) => state.isNightMode;
const selectDebugEnabled = (state: MapState) => state.debugEnabled;
const selectVatsimEnabled = (state: MapState) => state.vatsimEnabled;
