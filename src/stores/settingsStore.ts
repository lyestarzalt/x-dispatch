import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WeightUnit } from '@/lib/utils/format';

export type FontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
};

function applyFontSize(size: FontSize) {
  document.documentElement.style.fontSize = FONT_SIZE_MAP[size];
}

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

export interface SimBriefSettings {
  pilotId: string;
}

export interface AppearanceSettings {
  fontSize: FontSize;
}

interface SettingsState {
  map: MapSettings;
  simbrief: SimBriefSettings;
  appearance: AppearanceSettings;
  addonManagerEnabled: boolean;
  updateMapSettings: (settings: Partial<MapSettings>) => void;
  updateSimbriefSettings: (settings: Partial<SimBriefSettings>) => void;
  setFontSize: (size: FontSize) => void;
  setAddonManagerEnabled: (enabled: boolean) => void;
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

const DEFAULT_SIMBRIEF_SETTINGS: SimBriefSettings = {
  pilotId: '',
};

const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  fontSize: 'medium',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      map: DEFAULT_MAP_SETTINGS,
      simbrief: DEFAULT_SIMBRIEF_SETTINGS,
      appearance: DEFAULT_APPEARANCE_SETTINGS,
      addonManagerEnabled: false,

      updateMapSettings: (settings) =>
        set((state) => ({
          map: { ...state.map, ...settings },
        })),

      updateSimbriefSettings: (settings) =>
        set((state) => ({
          simbrief: { ...state.simbrief, ...settings },
        })),

      setFontSize: (size: FontSize) => {
        applyFontSize(size);
        set({ appearance: { fontSize: size } });
      },

      setAddonManagerEnabled: (enabled) => set({ addonManagerEnabled: enabled }),

      resetToDefaults: () => {
        applyFontSize(DEFAULT_APPEARANCE_SETTINGS.fontSize);
        set({
          map: DEFAULT_MAP_SETTINGS,
          simbrief: DEFAULT_SIMBRIEF_SETTINGS,
          appearance: DEFAULT_APPEARANCE_SETTINGS,
          addonManagerEnabled: false,
        });
      },
    }),
    {
      name: 'xplane-viz-settings',
      version: 10,
      migrate: (persistedState, version) => {
        if (version < 6) {
          return {
            map: DEFAULT_MAP_SETTINGS,
            simbrief: DEFAULT_SIMBRIEF_SETTINGS,
            appearance: DEFAULT_APPEARANCE_SETTINGS,
          };
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
        if (version < 8) {
          // Add SimBrief settings
          const state = persistedState as SettingsState;
          return {
            ...state,
            simbrief: DEFAULT_SIMBRIEF_SETTINGS,
          };
        }
        if (version < 9) {
          // Add appearance settings
          const state = persistedState as SettingsState;
          return {
            ...state,
            appearance: DEFAULT_APPEARANCE_SETTINGS,
          };
        }
        if (version < 10) {
          // Addon manager disabled by default
          const state = persistedState as SettingsState;
          return {
            ...state,
            addonManagerEnabled: false,
          };
        }
        return persistedState as SettingsState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyFontSize(state.appearance.fontSize);
        }
      },
    }
  )
);

export function initializeFontSize() {
  const { fontSize } = useSettingsStore.getState().appearance;
  applyFontSize(fontSize);
}
