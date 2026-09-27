import { create } from 'zustand';
import type { StandHover } from '@/lib/airports/standIdentity';

interface StandHoverState {
  hover: StandHover | null;
  setHover: (hover: StandHover | null) => void;
}

/**
 * Cursor-follow state for the stand hover card. Updated on every mousemove
 * over a gate ring, so it lives in its own store: only StandHoverCard
 * re-renders per move instead of the whole Map component tree.
 */
export const useStandHoverStore = create<StandHoverState>()((set) => ({
  hover: null,
  setHover: (hover) => set({ hover }),
}));
