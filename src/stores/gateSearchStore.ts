import { create } from 'zustand';

interface GateSearchState {
  /** Gate indices the airport panel's gate search matches; null while there is no search. */
  matches: readonly number[] | null;
  setMatches: (matches: readonly number[] | null) => void;
}

/**
 * What the gate search in the airport panel currently matches, so the map can fade the
 * other gates. Session state: it clears when the search box empties or the list goes away.
 */
export const useGateSearchStore = create<GateSearchState>()((set) => ({
  matches: null,
  setMatches: (matches) => set({ matches }),
}));
