import { create } from 'zustand';
import type { PlanePosition, PlaneState } from '@/types/xplane';

interface PlaneStoreState {
  /** Latest snapshot from the X-Plane stream, null until the first one. */
  state: PlaneState | null;
  connected: boolean;
  setState: (state: PlaneState | null) => void;
  setConnected: (connected: boolean) => void;
}

/**
 * Live aircraft state. Snapshots arrive several times a second, so they live
 * here rather than in React state of the Map component: only components that
 * select from this store re-render, and map-layer updates subscribe directly.
 */
export const usePlaneStore = create<PlaneStoreState>()((set) => ({
  state: null,
  connected: false,
  setState: (state) => set({ state }),
  setConnected: (connected) => set({ connected }),
}));

export function planePositionFrom(state: PlaneState | null): PlanePosition | null {
  if (!state) return null;
  return {
    lat: state.latitude,
    lng: state.longitude,
    altitude: state.altitudeMSL,
    altitudeAGL: state.altitudeAGL,
    heading: state.heading,
    groundspeed: state.groundspeed,
    aircraftCategory: state.aircraftCategory,
    icaoType: state.icaoType ?? '',
    tailNumber: state.tailNumber ?? '',
    wingspanM: state.wingspanM ?? null,
  };
}
