import { create } from 'zustand';
import type { ModuleRuntimeInfo } from '@/lib/modules/types';

interface ModulesStoreState {
  modules: ModuleRuntimeInfo[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useModulesStore = create<ModulesStoreState>((set) => ({
  modules: [],
  loading: false,
  initialized: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const modules = await window.modulesAPI.list();
      set({ modules, loading: false, initialized: true });
    } catch (err) {
      set({ loading: false, initialized: true, error: (err as Error).message });
    }
  },
}));

if (typeof window !== 'undefined' && window.modulesAPI?.onChanged) {
  window.modulesAPI.onChanged(() => {
    void useModulesStore.getState().refresh();
  });
}

export function isModuleEnabled(modules: ModuleRuntimeInfo[], moduleId: string): boolean {
  return modules.some((m) => m.manifest.id === moduleId && m.state.enabled);
}
