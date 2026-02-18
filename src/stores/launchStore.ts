import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Aircraft } from '@/types/aircraft';

interface LaunchState {
  // Selection
  selectedAircraft: Aircraft | null;
  selectedLivery: string;

  // Flight Config
  fuelPercentage: number;
  timeOfDay: number;
  useRealWorldTime: boolean;
  coldAndDark: boolean;
  selectedWeather: string;

  // Favorites (persisted to localStorage)
  favorites: string[];

  // UI State
  isLaunching: boolean;
  launchError: string | null;

  // Actions
  selectAircraft: (aircraft: Aircraft | null) => void;
  setSelectedLivery: (livery: string) => void;
  setFuelPercentage: (value: number) => void;
  setTimeOfDay: (value: number) => void;
  setUseRealWorldTime: (value: boolean) => void;
  setColdAndDark: (value: boolean) => void;
  setSelectedWeather: (value: string) => void;
  toggleFavorite: (path: string) => void;
  setIsLaunching: (value: boolean) => void;
  setLaunchError: (error: string | null) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG = {
  selectedAircraft: null,
  selectedLivery: 'Default',
  fuelPercentage: 50,
  timeOfDay: 12,
  useRealWorldTime: false,
  coldAndDark: false,
  selectedWeather: 'clear',
  isLaunching: false,
  launchError: null,
};

export const useLaunchStore = create<LaunchState>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      favorites: [],

      selectAircraft: (aircraft) =>
        set({
          selectedAircraft: aircraft,
          selectedLivery: 'Default',
          launchError: null,
        }),

      setSelectedLivery: (livery) => set({ selectedLivery: livery }),

      setFuelPercentage: (value) => set({ fuelPercentage: value }),

      setTimeOfDay: (value) => set({ timeOfDay: value }),

      setUseRealWorldTime: (value) => set({ useRealWorldTime: value }),

      setColdAndDark: (value) => set({ coldAndDark: value }),

      setSelectedWeather: (value) => set({ selectedWeather: value }),

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
        favorites: state.favorites,
      }),
    }
  )
);
