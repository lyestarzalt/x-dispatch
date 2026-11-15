/**
 * What the user told us about their scenery that the folders cannot say: the
 * tier a pack really belongs to when the classifier got it wrong, and the custom
 * groups they switch together. Kept per X-Plane folder, since a second install
 * has its own packs.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SceneryPriority } from '@/lib/addonManager/core/types';
import type { CustomGroup } from '@/lib/addonManager/scenery/groups';
import { uuid } from '@/lib/utils/uuid';

export interface SceneryPrefs {
  /** Folder name to the tier the user chose. */
  categoryOverrides: Record<string, SceneryPriority>;
  customGroups: CustomGroup[];
}

interface SceneryPrefsState {
  byXPlanePath: Record<string, SceneryPrefs>;
  setCategoryOverride: (
    xplanePath: string,
    folderName: string,
    tier: SceneryPriority | null
  ) => void;
  addCustomGroup: (xplanePath: string, group: Omit<CustomGroup, 'id'>) => string;
  updateCustomGroup: (
    xplanePath: string,
    id: string,
    patch: Partial<Omit<CustomGroup, 'id'>>
  ) => void;
  removeCustomGroup: (xplanePath: string, id: string) => void;
}

const EMPTY: SceneryPrefs = { categoryOverrides: {}, customGroups: [] };

/** The prefs for one X-Plane folder, never undefined. */
export function sceneryPrefsFor(state: SceneryPrefsState, xplanePath: string | null): SceneryPrefs {
  return (xplanePath && state.byXPlanePath[xplanePath]) || EMPTY;
}

export const useSceneryPrefsStore = create<SceneryPrefsState>()(
  persist(
    (set) => {
      const update = (xplanePath: string, fn: (prefs: SceneryPrefs) => SceneryPrefs) =>
        set((s) => ({
          byXPlanePath: {
            ...s.byXPlanePath,
            [xplanePath]: fn(s.byXPlanePath[xplanePath] ?? EMPTY),
          },
        }));
      return {
        byXPlanePath: {},
        setCategoryOverride: (xplanePath, folderName, tier) =>
          update(xplanePath, (prefs) => {
            const categoryOverrides = { ...prefs.categoryOverrides };
            if (tier === null) delete categoryOverrides[folderName];
            else categoryOverrides[folderName] = tier;
            return { ...prefs, categoryOverrides };
          }),
        addCustomGroup: (xplanePath, group) => {
          const id = uuid();
          update(xplanePath, (prefs) => ({
            ...prefs,
            customGroups: [...prefs.customGroups, { id, ...group }],
          }));
          return id;
        },
        updateCustomGroup: (xplanePath, id, patch) =>
          update(xplanePath, (prefs) => ({
            ...prefs,
            customGroups: prefs.customGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          })),
        removeCustomGroup: (xplanePath, id) =>
          update(xplanePath, (prefs) => ({
            ...prefs,
            customGroups: prefs.customGroups.filter((g) => g.id !== id),
          })),
      };
    },
    { name: 'scenery-prefs-store', version: 1 }
  )
);
