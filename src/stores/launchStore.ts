import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AircraftType,
  EngineType,
  LogbookEntry,
} from '@/components/dialogs/LaunchDialog/types';
import { getAircraftType } from '@/components/dialogs/LaunchDialog/types';
import {
  type CloudLayer,
  type CustomWeatherState,
  DEFAULT_CLOUD_LAYER,
  DEFAULT_WIND_LAYER,
  type WeatherConfig,
  type WindLayer,
  createDefaultWeatherConfig,
  getPresetDefaults,
} from '@/components/dialogs/LaunchDialog/weatherTypes';
import type { Aircraft } from '@/types/aircraft';

interface LaunchState {
  // Selection
  selectedAircraftPath: string | null;
  selectedAircraft: Aircraft | null;
  selectedLivery: string;

  // Flight Config
  tankPercentages: number[];
  payloadWeights: number[];
  timeOfDay: number;
  useRealWorldTime: boolean;
  coldAndDark: boolean;
  weatherConfig: WeatherConfig;

  // Aircraft filters (persisted)
  searchQuery: string;
  filterCategory: string;
  filterManufacturer: string;
  filterAircraftType: AircraftType;
  filterEngineType: EngineType;
  showFavoritesOnly: boolean;

  // Logbook (persisted, FIFO max 10)
  logbook: LogbookEntry[];

  // Last selected livery per aircraft path (persisted)
  lastLiveryByAircraft: Record<string, string>;

  // Last selected aircraft per type filter (persisted)
  lastAircraftByType: Record<string, string>;

  // Favorites (persisted to localStorage)
  favorites: string[];

  // UI State
  isLaunching: boolean;
  launchError: string | null;

  // Actions
  addLogbookEntry: (entry: LogbookEntry) => void;
  removeLogbookEntry: (id: string) => void;
  clearLogbook: () => void;
  setWeatherConfig: (config: WeatherConfig) => void;
  selectAircraft: (aircraft: Aircraft | null) => void;
  hydrateAircraft: (aircraft: Aircraft | null) => void;
  setSelectedLivery: (livery: string) => void;
  setTankPercentage: (index: number, value: number) => void;
  setAllTanksPercentage: (value: number) => void;
  setPayloadWeight: (index: number, value: number) => void;
  setTimeOfDay: (value: number) => void;
  setUseRealWorldTime: (value: boolean) => void;
  setColdAndDark: (value: boolean) => void;
  setWeatherMode: (mode: WeatherConfig['mode']) => void;
  setWeatherPreset: (preset: string) => void;
  updateCustomWeather: (partial: Partial<CustomWeatherState>) => void;
  addCloudLayer: () => void;
  removeCloudLayer: (index: number) => void;
  updateCloudLayer: (index: number, data: Partial<CloudLayer>) => void;
  addWindLayer: () => void;
  removeWindLayer: (index: number) => void;
  updateWindLayer: (index: number, data: Partial<WindLayer>) => void;
  setSearchQuery: (value: string) => void;
  setFilterCategory: (value: string) => void;
  setFilterManufacturer: (value: string) => void;
  setFilterAircraftType: (value: AircraftType) => void;
  setFilterEngineType: (value: EngineType) => void;
  setShowFavoritesOnly: (value: boolean) => void;
  toggleFavorite: (path: string) => void;
  setIsLaunching: (value: boolean) => void;
  setLaunchError: (error: string | null) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG = {
  selectedAircraftPath: null as string | null,
  selectedAircraft: null as Aircraft | null,
  selectedLivery: 'Default',
  tankPercentages: [] as number[],
  payloadWeights: [] as number[],
  timeOfDay: 12,
  useRealWorldTime: false,
  coldAndDark: false,
  weatherConfig: createDefaultWeatherConfig(),
  searchQuery: '',
  filterCategory: 'all',
  filterManufacturer: 'all',
  filterAircraftType: 'all' as AircraftType,
  filterEngineType: 'all' as EngineType,
  showFavoritesOnly: false,
  isLaunching: false,
  launchError: null,
};

export const useLaunchStore = create<LaunchState>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      logbook: [],
      lastLiveryByAircraft: {},
      lastAircraftByType: {},
      favorites: [],

      addLogbookEntry: (entry) =>
        set((state) => ({
          logbook: [entry, ...state.logbook].slice(0, 10),
        })),

      removeLogbookEntry: (id) =>
        set((state) => ({
          logbook: state.logbook.filter((e) => e.id !== id),
        })),

      clearLogbook: () => set({ logbook: [] }),

      setWeatherConfig: (config) => set({ weatherConfig: config }),

      selectAircraft: (aircraft) =>
        set((state) => {
          const lastAircraftByType = { ...state.lastAircraftByType };
          if (aircraft) {
            // Save under current filter AND the aircraft's actual type
            // so switching to "helicopter" restores even if selected while on "all"
            if (state.filterAircraftType) {
              lastAircraftByType[state.filterAircraftType] = aircraft.path;
            }
            const actualType = getAircraftType(aircraft);
            lastAircraftByType[actualType] = aircraft.path;
          }
          return {
            selectedAircraftPath: aircraft?.path ?? null,
            selectedAircraft: aircraft,
            selectedLivery: (aircraft && state.lastLiveryByAircraft[aircraft.path]) || 'Default',
            tankPercentages: aircraft ? new Array((aircraft.tankNames ?? []).length).fill(50) : [],
            payloadWeights: aircraft
              ? new Array((aircraft.payloadStations ?? []).length).fill(0)
              : [],
            lastAircraftByType,
            launchError: null,
          };
        }),

      hydrateAircraft: (aircraft) =>
        set((state) => {
          if (!aircraft) {
            return {
              selectedAircraftPath: null,
              selectedAircraft: null,
              selectedLivery: 'Default',
              tankPercentages: [],
              payloadWeights: [],
            };
          }

          // Validate livery exists in fresh data
          const liveryExists = aircraft.liveries.some((l) => l.name === state.selectedLivery);
          const selectedLivery = liveryExists ? state.selectedLivery : 'Default';

          // Validate tank/payload array lengths match fresh data
          const expectedTanks = (aircraft.tankNames ?? []).length;
          const tankPercentages =
            state.tankPercentages.length === expectedTanks
              ? state.tankPercentages
              : new Array(expectedTanks).fill(50);

          const expectedPayload = (aircraft.payloadStations ?? []).length;
          const payloadWeights =
            state.payloadWeights.length === expectedPayload
              ? state.payloadWeights
              : new Array(expectedPayload).fill(0);

          return {
            selectedAircraft: aircraft,
            selectedLivery,
            tankPercentages,
            payloadWeights,
          };
        }),

      setSelectedLivery: (livery) =>
        set((state) => {
          const lastLiveryByAircraft = { ...state.lastLiveryByAircraft };
          if (state.selectedAircraft) {
            lastLiveryByAircraft[state.selectedAircraft.path] = livery;
          }
          return { selectedLivery: livery, lastLiveryByAircraft };
        }),

      setTankPercentage: (index, value) =>
        set((state) => {
          const tankPercentages = [...state.tankPercentages];
          tankPercentages[index] = value;
          return { tankPercentages };
        }),

      setAllTanksPercentage: (value) =>
        set((state) => ({
          tankPercentages: state.tankPercentages.map(() => value),
        })),

      setPayloadWeight: (index, value) =>
        set((state) => {
          const payloadWeights = [...state.payloadWeights];
          payloadWeights[index] = value;
          return { payloadWeights };
        }),

      setTimeOfDay: (value) => set({ timeOfDay: value }),

      setUseRealWorldTime: (value) => set({ useRealWorldTime: value }),

      setColdAndDark: (value) => set({ coldAndDark: value }),

      setWeatherMode: (mode) =>
        set((state) => ({
          weatherConfig: { ...state.weatherConfig, mode },
        })),

      setWeatherPreset: (preset) => {
        const defaults = getPresetDefaults(preset);
        set({
          weatherConfig: {
            mode: preset === 'real' ? 'real' : 'preset',
            preset,
            custom: {
              ...defaults,
              clouds: defaults.clouds.map((c) => ({ ...c })),
              wind: defaults.wind.map((w) => ({ ...w })),
            },
          },
        });
      },

      updateCustomWeather: (partial) =>
        set((state) => ({
          weatherConfig: {
            ...state.weatherConfig,
            mode: 'custom',
            custom: { ...state.weatherConfig.custom, ...partial },
          },
        })),

      addCloudLayer: () =>
        set((state) => {
          const clouds = state.weatherConfig.custom.clouds;
          if (clouds.length >= 3) return state;
          // Place new cloud above existing ones at predictable altitudes
          const highestTops = clouds.reduce((m, c) => Math.max(m, c.tops_ft), 0);
          const newBase = highestTops > 0 ? highestTops + 2000 : DEFAULT_CLOUD_LAYER.base_ft;
          const newTops = newBase + 5000;
          return {
            weatherConfig: {
              ...state.weatherConfig,
              mode: 'custom',
              custom: {
                ...state.weatherConfig.custom,
                clouds: [...clouds, { ...DEFAULT_CLOUD_LAYER, base_ft: newBase, tops_ft: newTops }],
              },
            },
          };
        }),

      removeCloudLayer: (index) =>
        set((state) => ({
          weatherConfig: {
            ...state.weatherConfig,
            mode: 'custom',
            custom: {
              ...state.weatherConfig.custom,
              clouds: state.weatherConfig.custom.clouds.filter((_, i) => i !== index),
            },
          },
        })),

      updateCloudLayer: (index, data) =>
        set((state) => {
          const clouds = state.weatherConfig.custom.clouds.map((c, i) =>
            i === index ? { ...c, ...data } : c
          );
          return {
            weatherConfig: {
              ...state.weatherConfig,
              mode: 'custom',
              custom: { ...state.weatherConfig.custom, clouds },
            },
          };
        }),

      addWindLayer: () =>
        set((state) => {
          const wind = state.weatherConfig.custom.wind;
          if (wind.length >= 13) return state;
          // Place next layer at 5000 ft increments above highest existing
          const maxAlt = wind.reduce((m, w) => Math.max(m, w.altitude_ft), 0);
          const newAlt = Math.min(maxAlt + 5000, 50000);
          return {
            weatherConfig: {
              ...state.weatherConfig,
              mode: 'custom',
              custom: {
                ...state.weatherConfig.custom,
                wind: [...wind, { ...DEFAULT_WIND_LAYER, altitude_ft: newAlt }],
              },
            },
          };
        }),

      removeWindLayer: (index) =>
        set((state) => ({
          weatherConfig: {
            ...state.weatherConfig,
            mode: 'custom',
            custom: {
              ...state.weatherConfig.custom,
              wind: state.weatherConfig.custom.wind.filter((_, i) => i !== index),
            },
          },
        })),

      updateWindLayer: (index, data) =>
        set((state) => {
          const wind = state.weatherConfig.custom.wind.map((w, i) =>
            i === index ? { ...w, ...data } : w
          );
          return {
            weatherConfig: {
              ...state.weatherConfig,
              mode: 'custom',
              custom: { ...state.weatherConfig.custom, wind },
            },
          };
        }),

      setSearchQuery: (value) => set({ searchQuery: value }),
      setFilterCategory: (value) => set({ filterCategory: value }),
      setFilterManufacturer: (value) => set({ filterManufacturer: value }),
      setFilterAircraftType: (value) =>
        set((state) => {
          const lastPath = state.lastAircraftByType[value];
          return {
            filterAircraftType: value,
            // Restore last selected aircraft for this filter; clear selectedAircraft
            // so the hydration effect in LaunchDialog re-runs with the new path
            ...(lastPath ? { selectedAircraftPath: lastPath, selectedAircraft: null } : {}),
          };
        }),
      setFilterEngineType: (value) => set({ filterEngineType: value }),
      setShowFavoritesOnly: (value) => set({ showFavoritesOnly: value }),

      toggleFavorite: (path) =>
        set((state) => ({
          favorites: state.favorites.includes(path)
            ? state.favorites.filter((p) => p !== path)
            : [...state.favorites, path],
        })),

      setIsLaunching: (value) => set({ isLaunching: value }),

      setLaunchError: (error) => set({ launchError: error }),

      resetConfig: () => set(DEFAULT_CONFIG),
    }),
    {
      name: 'launch-store',
      partialize: (state) => ({
        logbook: state.logbook,
        lastLiveryByAircraft: state.lastLiveryByAircraft,
        lastAircraftByType: state.lastAircraftByType,
        favorites: state.favorites,
        selectedAircraftPath: state.selectedAircraftPath,
        selectedLivery: state.selectedLivery,
        tankPercentages: state.tankPercentages,
        payloadWeights: state.payloadWeights,
        timeOfDay: state.timeOfDay,
        useRealWorldTime: state.useRealWorldTime,
        coldAndDark: state.coldAndDark,
        weatherConfig: state.weatherConfig,
        searchQuery: state.searchQuery,
        filterCategory: state.filterCategory,
        filterManufacturer: state.filterManufacturer,
        filterAircraftType: state.filterAircraftType,
        filterEngineType: state.filterEngineType,
        showFavoritesOnly: state.showFavoritesOnly,
      }),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;

        // v0 → v1: fuelPercentage → tankPercentages
        if (version < 1) {
          if ('fuelPercentage' in state && !('tankPercentages' in state)) {
            const pct = (state.fuelPercentage as number) ?? 50;
            const aircraft = state.selectedAircraft as Aircraft | null;
            const tankCount = aircraft?.tankNames.length || 0;
            state.tankPercentages = new Array(tankCount).fill(pct);
            state.payloadWeights = new Array(aircraft?.payloadStations?.length || 0).fill(0);
            delete state.fuelPercentage;
          }
        }

        // v1 → v2: selectedWeather → weatherConfig
        if (version < 2) {
          if ('selectedWeather' in state && !('weatherConfig' in state)) {
            const weather = (state.selectedWeather as string) || 'clear';
            const defaults = getPresetDefaults(weather);
            state.weatherConfig = {
              mode: weather === 'real' ? 'real' : 'preset',
              preset: weather,
              custom: {
                ...defaults,
                clouds: defaults.clouds.map((c) => ({ ...c })),
                wind: defaults.wind.map((w) => ({ ...w })),
              },
            } satisfies WeatherConfig;
            delete state.selectedWeather;
          }
        }

        // v2 → v3: flat wind fields → wind[] array, temperature_offset_c → temperature_c, add altimeter_hpa
        if (version < 3) {
          const wc = state.weatherConfig as Record<string, unknown> | undefined;
          if (wc) {
            const custom = wc.custom as Record<string, unknown> | undefined;
            if (custom) {
              // Migrate flat wind → wind array
              if (!('wind' in custom) || !Array.isArray(custom.wind)) {
                const speed = (custom.wind_speed_kts as number) ?? 10;
                const dir = (custom.wind_direction_deg as number) ?? 270;
                const gust = (custom.wind_gust_kts as number) ?? 0;
                custom.wind = [
                  {
                    altitude_ft: 0,
                    speed_kts: speed,
                    direction_deg: dir,
                    gust_kts: gust,
                    shear_deg: 0,
                    turbulence: 0,
                  },
                ];
                delete custom.wind_speed_kts;
                delete custom.wind_direction_deg;
                delete custom.wind_gust_kts;
              }

              // Migrate temperature_offset_c → temperature_c
              if ('temperature_offset_c' in custom && !('temperature_c' in custom)) {
                custom.temperature_c = 15 + ((custom.temperature_offset_c as number) ?? 0);
                delete custom.temperature_offset_c;
              }

              // Add altimeter_hpa if missing
              if (!('altimeter_hpa' in custom)) {
                custom.altimeter_hpa = 1013.25;
              }
            }
          }
        }

        // v3 → v4: add outer wrapper fields (thermal, wave, terrain, variation, evolution)
        if (version < 4) {
          const wc = state.weatherConfig as Record<string, unknown> | undefined;
          if (wc) {
            const custom = wc.custom as Record<string, unknown> | undefined;
            if (custom) {
              if (!('thermal_fpm' in custom)) custom.thermal_fpm = 0;
              if (!('wave_height_m' in custom)) custom.wave_height_m = 1;
              if (!('wave_direction_deg' in custom)) custom.wave_direction_deg = 270;
              if (!('variation_pct' in custom)) custom.variation_pct = 0;
              if (!('evolution' in custom)) custom.evolution = 'static';
              // Migrate old simplified terrain_state to full API values
              const ts = custom.terrain_state as string;
              if (ts === 'wet') custom.terrain_state = 'medium_wet';
              else if (ts === 'snowy') custom.terrain_state = 'medium_snowy';
              else if (ts === 'icy') custom.terrain_state = 'medium_icy';
            }
          }
        }

        // v4 → v5: add aircraft list filter fields
        if (version < 5) {
          if (!('searchQuery' in state)) state.searchQuery = '';
          if (!('filterCategory' in state)) state.filterCategory = 'all';
          if (!('filterManufacturer' in state)) state.filterManufacturer = 'all';
          if (!('filterAircraftType' in state)) state.filterAircraftType = 'all';
          if (!('filterEngineType' in state)) state.filterEngineType = 'all';
          if (!('showFavoritesOnly' in state)) state.showFavoritesOnly = false;
        }

        // v5 → v6: persist aircraft path instead of full object
        if (version < 6) {
          const aircraft = state.selectedAircraft as Aircraft | null;
          state.selectedAircraftPath = aircraft?.path ?? null;
          delete state.selectedAircraft;
        }

        // v6 → v7: add logbook
        if (version < 7) {
          state.logbook = (state.logbook as LogbookEntry[] | undefined) ?? [];
        }

        // v7 → v8: add lastLiveryByAircraft
        if (version < 8) {
          if (!('lastLiveryByAircraft' in state)) state.lastLiveryByAircraft = {};
        }

        // v8 → v9: add lastAircraftByType
        if (version < 9) {
          if (!('lastAircraftByType' in state)) state.lastAircraftByType = {};
        }

        return state as unknown as LaunchState;
      },
      version: 9,
    }
  )
);
