import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { validateMapStyleUrl } from '@/lib/map/tileUrlToStyle';
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

export interface MapStyle {
  id: string;
  name: string;
  url: string;
}

export const MAP_STYLE_PRESETS: ReadonlyArray<MapStyle> = [
  {
    id: 'carto-dark',
    name: 'Dark',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  {
    id: 'ofm-liberty',
    name: 'Light + 3D',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  {
    id: 'carto-positron',
    name: 'Light',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  {
    id: 'esri-satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
];

const DEFAULT_MAP_STYLE_URL =
  MAP_STYLE_PRESETS.find((s) => s.id === 'carto-dark')?.url ?? MAP_STYLE_PRESETS[0]?.url ?? '';

export interface MapSettings {
  navDataRadiusNm: number;
  vatsimRefreshInterval: number;
  mapStyleUrl: string;
  /** User-added custom map styles, rendered alongside MAP_STYLE_PRESETS in the picker. */
  userMapStyles: MapStyle[];
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
  debugOverlay: boolean;
}

export type SurfaceDetail = 'low' | 'medium' | 'high';

export interface GraphicsSettings {
  /** Approach light sequenced flash animation */
  approachLightAnimation: boolean;
  /** Taxiway light glow layers (3-layer vs core only) */
  taxiwayLightGlow: boolean;
  /** Surface detail — curve smoothness for taxiway/pavement edges */
  surfaceDetail: SurfaceDetail;
}

export interface LauncherSettings {
  closeOnLaunch: boolean;
  customLaunchArgs: string[];
}

export interface SupportSettings {
  /** User permanently dismissed the support prompt */
  promptDismissed: boolean;
}

interface SettingsState {
  map: MapSettings;
  simbrief: SimBriefSettings;
  appearance: AppearanceSettings;
  graphics: GraphicsSettings;
  launcher: LauncherSettings;
  support: SupportSettings;
  updateMapSettings: (settings: Partial<MapSettings>) => void;
  addUserMapStyle: (style: MapStyle) => void;
  removeUserMapStyle: (id: string) => void;
  updateSimbriefSettings: (settings: Partial<SimBriefSettings>) => void;
  updateGraphicsSettings: (settings: Partial<GraphicsSettings>) => void;
  updateLauncherSettings: (settings: Partial<LauncherSettings>) => void;
  updateSupportSettings: (settings: Partial<SupportSettings>) => void;
  setFontSize: (size: FontSize) => void;
  setZoomLevel: (level: number) => void;
  setDebugOverlay: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const DEFAULT_MAP_SETTINGS: MapSettings = {
  navDataRadiusNm: 100,
  vatsimRefreshInterval: 15,
  mapStyleUrl: DEFAULT_MAP_STYLE_URL,
  userMapStyles: [],
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
  debugOverlay: false,
};

function applyZoomLevel(level: number) {
  window.appAPI?.setZoomFactor(level);
}

const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  approachLightAnimation: true,
  taxiwayLightGlow: true,
  surfaceDetail: 'high',
};

const DEFAULT_LAUNCHER_SETTINGS: LauncherSettings = {
  closeOnLaunch: false,
  customLaunchArgs: [],
};

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  promptDismissed: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      map: DEFAULT_MAP_SETTINGS,
      simbrief: DEFAULT_SIMBRIEF_SETTINGS,
      appearance: DEFAULT_APPEARANCE_SETTINGS,
      graphics: DEFAULT_GRAPHICS_SETTINGS,
      launcher: DEFAULT_LAUNCHER_SETTINGS,
      support: DEFAULT_SUPPORT_SETTINGS,

      updateMapSettings: (settings) =>
        set((state) => ({
          map: { ...state.map, ...settings },
        })),

      addUserMapStyle: (style) =>
        set((state) => {
          // Validate at the boundary — reject malformed URLs no matter who calls.
          if (validateMapStyleUrl(style.url) !== null) return state;
          // Defensive fallback: persisted users from before v20 may not have the field.
          const current = state.map.userMapStyles ?? [];
          // Skip duplicates by URL — the picker doesn't need two entries for the same target.
          if (current.some((s) => s.url === style.url)) {
            return current === state.map.userMapStyles
              ? state
              : { map: { ...state.map, userMapStyles: current } };
          }
          return {
            map: { ...state.map, userMapStyles: [...current, style] },
          };
        }),

      removeUserMapStyle: (id) =>
        set((state) => {
          const current = state.map.userMapStyles ?? [];
          const next = current.filter((s) => s.id !== id);
          if (next.length === current.length) return state;
          // If the user is currently using the style they're deleting, fall back to the
          // default preset so the map doesn't render a phantom URL.
          const removed = current.find((s) => s.id === id);
          const mapStyleUrl =
            removed && state.map.mapStyleUrl === removed.url
              ? DEFAULT_MAP_STYLE_URL
              : state.map.mapStyleUrl;
          return {
            map: { ...state.map, userMapStyles: next, mapStyleUrl },
          };
        }),

      updateSimbriefSettings: (settings) =>
        set((state) => ({
          simbrief: { ...state.simbrief, ...settings },
        })),

      updateGraphicsSettings: (settings) =>
        set((state) => ({
          graphics: { ...state.graphics, ...settings },
        })),

      updateLauncherSettings: (settings) =>
        set((state) => ({
          launcher: { ...state.launcher, ...settings },
        })),

      updateSupportSettings: (settings) =>
        set((state) => ({
          support: { ...state.support, ...settings },
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

      setDebugOverlay: (enabled: boolean) =>
        set((state) => ({ appearance: { ...state.appearance, debugOverlay: enabled } })),

      resetToDefaults: () => {
        applyFontSize(DEFAULT_APPEARANCE_SETTINGS.fontSize);
        applyZoomLevel(DEFAULT_APPEARANCE_SETTINGS.zoomLevel);
        set({
          map: DEFAULT_MAP_SETTINGS,
          simbrief: DEFAULT_SIMBRIEF_SETTINGS,
          appearance: DEFAULT_APPEARANCE_SETTINGS,
          graphics: DEFAULT_GRAPHICS_SETTINGS,
          launcher: DEFAULT_LAUNCHER_SETTINGS,
          support: DEFAULT_SUPPORT_SETTINGS,
        });
      },
    }),
    {
      name: 'xplane-viz-settings',
      version: 20,
      migrate: (persistedState, version) => migrateSettings(persistedState, version),
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

/**
 * Cascade-style migrations: each step takes the running state and returns
 * the updated state. Zustand's persist calls this ONCE with the source
 * version, so we must apply every step from (version+1) up to current in a
 * single pass. The earlier early-return pattern silently skipped later
 * steps for anyone on an old version, leaving them with missing fields.
 *
 * Exported for direct unit testing.
 */
export function migrateSettings(persistedState: unknown, version: number): SettingsState {
  let state = persistedState as Partial<SettingsState>;

  if (version < 6) {
    state = {
      map: DEFAULT_MAP_SETTINGS,
      simbrief: DEFAULT_SIMBRIEF_SETTINGS,
      appearance: DEFAULT_APPEARANCE_SETTINGS,
    };
  }
  if (version < 7) {
    // Add units preference
    state = {
      ...state,
      map: { ...state.map!, units: DEFAULT_MAP_SETTINGS.units },
    };
  }
  if (version < 8) {
    // Add SimBrief settings
    state = { ...state, simbrief: DEFAULT_SIMBRIEF_SETTINGS };
  }
  if (version < 9) {
    // Add appearance settings
    state = { ...state, appearance: DEFAULT_APPEARANCE_SETTINGS };
  }
  if (version < 11) {
    // Add launcher settings
    state = { ...state, launcher: DEFAULT_LAUNCHER_SETTINGS };
  }
  if (version < 12) {
    // Add idle orbit setting (default off)
    state = {
      ...state,
      map: { ...state.map!, idleOrbitEnabled: false },
    };
  }
  if (version < 13) {
    // Add zoom level to appearance
    state = {
      ...state,
      appearance: { ...state.appearance!, zoomLevel: 1.0 },
    };
  }
  if (version < 14) {
    state = {
      ...state,
      launcher: { ...state.launcher!, customLaunchArgs: [] },
    };
  }
  if (version < 15) {
    state = {
      ...state,
      appearance: { ...state.appearance!, debugOverlay: false },
    };
  }
  if (version < 16) {
    // Add graphics settings
    state = { ...state, graphics: DEFAULT_GRAPHICS_SETTINGS };
  }
  if (version < 17) {
    // Add taxiwayLightGlow and surfaceDetail to graphics
    state = {
      ...state,
      graphics: { ...DEFAULT_GRAPHICS_SETTINGS, ...state.graphics },
    };
  }
  if (version < 18) {
    // Add support settings
    state = { ...state, support: DEFAULT_SUPPORT_SETTINGS };
  }
  if (version < 19) {
    // Map style picker redesign — roll dropped styles forward to CARTO Positron.
    const droppedUrls = new Set([
      'https://tiles.openfreemap.org/styles/bright',
      'https://tiles.openfreemap.org/styles/positron',
      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    ]);
    const positronUrl = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    if (state.map?.mapStyleUrl && droppedUrls.has(state.map.mapStyleUrl)) {
      state = {
        ...state,
        map: { ...state.map, mapStyleUrl: positronUrl },
      };
    }
  }
  if (version < 20) {
    // Add userMapStyles array to MapSettings (custom-URL chip flow).
    state = {
      ...state,
      map: { ...state.map!, userMapStyles: state.map?.userMapStyles ?? [] },
    };
  }

  return state as SettingsState;
}

export function initializeFontSize() {
  const { fontSize } = useSettingsStore.getState().appearance;
  applyFontSize(fontSize);
}
