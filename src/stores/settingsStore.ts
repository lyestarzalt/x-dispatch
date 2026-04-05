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
  MAP_STYLE_PRESETS.find((s) => s.id === 'carto-dark')?.url ?? MAP_STYLE_PRESETS[0]?.url ?? '';

export interface MapSettings {
  navDataRadiusNm: number;
  vatsimRefreshInterval: number;
  mapStyleUrl: string;
  idleOrbitEnabled: boolean;
  units: {
    weight: WeightUnit;
  };
}

export interface SimBriefSettings {
  pilotId: string;
}

export interface AppearanceSettings {
  fontSize: FontSize;
  /** Zoom factor for the entire UI (0.7–1.3, default 1.0) */
  zoomLevel: number;
}

export interface LauncherSettings {
  closeOnLaunch: boolean;
  customLaunchArgs: string[];
}

interface SettingsState {
  map: MapSettings;
  simbrief: SimBriefSettings;
  appearance: AppearanceSettings;
  launcher: LauncherSettings;
  updateMapSettings: (settings: Partial<MapSettings>) => void;
  updateSimbriefSettings: (settings: Partial<SimBriefSettings>) => void;
  updateLauncherSettings: (settings: Partial<LauncherSettings>) => void;
  setFontSize: (size: FontSize) => void;
  setZoomLevel: (level: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_MAP_SETTINGS: MapSettings = {
  navDataRadiusNm: 100,
  vatsimRefreshInterval: 15,
  mapStyleUrl: DEFAULT_MAP_STYLE_URL,
  idleOrbitEnabled: false,
  units: {
    weight: 'lbs',
  },
};

const DEFAULT_SIMBRIEF_SETTINGS: SimBriefSettings = {
  pilotId: '',
};

const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  fontSize: 'medium',
  zoomLevel: 1.0,
};

function applyZoomLevel(level: number) {
  window.appAPI?.setZoomFactor(level);
}

const DEFAULT_LAUNCHER_SETTINGS: LauncherSettings = {
  closeOnLaunch: false,
  customLaunchArgs: [],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      map: DEFAULT_MAP_SETTINGS,
      simbrief: DEFAULT_SIMBRIEF_SETTINGS,
      appearance: DEFAULT_APPEARANCE_SETTINGS,
      launcher: DEFAULT_LAUNCHER_SETTINGS,

      updateMapSettings: (settings) =>
        set((state) => ({
          map: { ...state.map, ...settings },
        })),

      updateSimbriefSettings: (settings) =>
        set((state) => ({
          simbrief: { ...state.simbrief, ...settings },
        })),

      updateLauncherSettings: (settings) =>
        set((state) => ({
          launcher: { ...state.launcher, ...settings },
        })),

      setFontSize: (size: FontSize) => {
        applyFontSize(size);
        set((state) => ({ appearance: { ...state.appearance, fontSize: size } }));
      },

      setZoomLevel: (level: number) => {
        const safe = Number.isFinite(level) ? level : 1.0;
        const clamped = Math.round(Math.max(70, Math.min(130, safe * 100))) / 100;
        applyZoomLevel(clamped);
        set((state) => ({ appearance: { ...state.appearance, zoomLevel: clamped } }));
      },

      resetToDefaults: () => {
        applyFontSize(DEFAULT_APPEARANCE_SETTINGS.fontSize);
        applyZoomLevel(DEFAULT_APPEARANCE_SETTINGS.zoomLevel);
        set({
          map: DEFAULT_MAP_SETTINGS,
          simbrief: DEFAULT_SIMBRIEF_SETTINGS,
          appearance: DEFAULT_APPEARANCE_SETTINGS,
          launcher: DEFAULT_LAUNCHER_SETTINGS,
        });
      },
    }),
    {
      name: 'xplane-viz-settings',
      version: 14,
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
        if (version < 11) {
          // Add launcher settings
          const state = persistedState as SettingsState;
          return {
            ...state,
            launcher: DEFAULT_LAUNCHER_SETTINGS,
          };
        }
        if (version < 12) {
          // Add idle orbit setting (default off)
          const state = persistedState as SettingsState;
          return {
            ...state,
            map: {
              ...state.map,
              idleOrbitEnabled: false,
            },
          };
        }
        if (version < 13) {
          // Add zoom level to appearance
          const state = persistedState as SettingsState;
          return {
            ...state,
            appearance: {
              ...state.appearance,
              zoomLevel: 1.0,
            },
          };
        }
        if (version < 14) {
          const state = persistedState as SettingsState;
          return {
            ...state,
            launcher: {
              ...state.launcher,
              customLaunchArgs: [],
            },
          };
        }
        return persistedState as SettingsState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyFontSize(state.appearance.fontSize);
          const zoom = state.appearance.zoomLevel;
          applyZoomLevel(Number.isFinite(zoom) ? zoom : 1.0);
        }
      },
    }
  )
);

export function initializeFontSize() {
  const { fontSize } = useSettingsStore.getState().appearance;
  applyFontSize(fontSize);
}
