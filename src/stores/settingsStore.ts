import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WeightUnit } from '@/lib/format';

interface MapStylePreset {
  id: string;
  name: string;
  url: string;
  provider: 'openfreemap' | 'carto';
}

export const MAP_STYLE_PRESETS: MapStylePreset[] = [
  {
    id: 'ofm-liberty',
    name: 'Liberty',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    provider: 'openfreemap',
  },
  {
    id: 'ofm-bright',
    name: 'Bright',
    url: 'https://tiles.openfreemap.org/styles/bright',
    provider: 'openfreemap',
  },
  {
    id: 'ofm-positron',
    name: 'Positron',
    url: 'https://tiles.openfreemap.org/styles/positron',
    provider: 'openfreemap',
  },
  {
    id: 'carto-dark',
    name: 'Dark Matter',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    provider: 'carto',
  },
  {
    id: 'carto-positron',
    name: 'Positron',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    provider: 'carto',
  },
  {
    id: 'carto-voyager',
    name: 'Voyager',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    provider: 'carto',
  },
];

const DEFAULT_MAP_STYLE_URL =
  MAP_STYLE_PRESETS.find((s) => s.id === 'carto-dark')?.url ?? MAP_STYLE_PRESETS[0].url;

export interface MapSettings {
  navDataRadiusNm: number;
  vatsimRefreshInterval: number;
  mapStyleUrl: string;
  units: {
    weight: WeightUnit;
  };
}

interface SettingsState {
  map: MapSettings;
  updateMapSettings: (settings: Partial<MapSettings>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_MAP_SETTINGS: MapSettings = {
  navDataRadiusNm: 100,
  vatsimRefreshInterval: 15,
  mapStyleUrl: DEFAULT_MAP_STYLE_URL,
  units: {
    weight: 'lbs',
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      map: DEFAULT_MAP_SETTINGS,

      updateMapSettings: (settings) =>
        set((state) => ({
          map: { ...state.map, ...settings },
        })),

      resetToDefaults: () => set({ map: DEFAULT_MAP_SETTINGS }),
    }),
    {
      name: 'xplane-viz-settings',
      version: 7,
      migrate: (persistedState, version) => {
        if (version < 6) {
          return { map: DEFAULT_MAP_SETTINGS };
        }
        if (version < 7) {
          // Add units preference
          const state = persistedState as SettingsState;
          return {
            ...state,
            map: {
              ...state.map,
              units: DEFAULT_MAP_SETTINGS.units,
            },
          };
        }
        return persistedState as SettingsState;
      },
    }
  )
);
