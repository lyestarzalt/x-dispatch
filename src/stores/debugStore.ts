import { create } from 'zustand';
import type { DetachedPanel, TabId } from '@/components/Map/widgets/DevDebugOverlay/types';

interface DebugState {
  detached: DetachedPanel[];
  togglePanel: (id: TabId) => void;
  closePanel: (id: TabId) => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  detached: [],
  togglePanel: (id) =>
    set((state) => {
      if (state.detached.some((d) => d.id === id)) {
        return { detached: state.detached.filter((d) => d.id !== id) };
      }
      const x = Math.round(window.innerWidth / 2 - 160);
      const y = Math.round(window.innerHeight / 3 + state.detached.length * 30);
      return { detached: [...state.detached, { id, x, y }] };
    }),
  closePanel: (id) => set((state) => ({ detached: state.detached.filter((d) => d.id !== id) })),
}));
