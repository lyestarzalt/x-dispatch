import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uuid } from '@/lib/utils/uuid';
import type { Seconds } from '@/types/units';

export interface CompanionApp {
  id: string;
  name: string;
  exePath: string;
  args?: string;
  cwd?: string;
  autoLaunch: boolean;
  delayBeforeXPlaneSec: Seconds;
}

interface CompanionAppsState {
  tools: CompanionApp[];
  addTool: (input: Omit<CompanionApp, 'id'>) => void;
  updateTool: (id: string, patch: Partial<Omit<CompanionApp, 'id'>>) => void;
  removeTool: (id: string) => void;
}

export const useCompanionAppsStore = create<CompanionAppsState>()(
  persist(
    (set) => ({
      tools: [],
      addTool: (input) =>
        set((s) => ({
          tools: [...s.tools, { id: uuid(), ...input }],
        })),
      updateTool: (id, patch) =>
        set((s) => ({
          tools: s.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTool: (id) => set((s) => ({ tools: s.tools.filter((t) => t.id !== id) })),
    }),
    { name: 'companion-apps-store', version: 1 }
  )
);
