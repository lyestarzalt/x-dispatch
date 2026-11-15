import { beforeEach, describe, expect, it } from 'vitest';
import { SceneryPriority } from '@/lib/addonManager/core/types';
import { sceneryPrefsFor, useSceneryPrefsStore } from './sceneryPrefsStore';

const XP = '/sims/X-Plane 12';

beforeEach(() => {
  useSceneryPrefsStore.setState({ byXPlanePath: {} });
});

describe('sceneryPrefsStore', () => {
  it('keeps tier overrides per X-Plane folder and clears them with null', () => {
    const store = useSceneryPrefsStore.getState();
    store.setCategoryOverride(XP, 'Odd', SceneryPriority.Library);
    store.setCategoryOverride('/other', 'Odd', SceneryPriority.Mesh);
    expect(sceneryPrefsFor(useSceneryPrefsStore.getState(), XP).categoryOverrides).toEqual({
      Odd: SceneryPriority.Library,
    });
    store.setCategoryOverride(XP, 'Odd', null);
    expect(sceneryPrefsFor(useSceneryPrefsStore.getState(), XP).categoryOverrides).toEqual({});
    expect(sceneryPrefsFor(useSceneryPrefsStore.getState(), null)).toEqual({
      categoryOverrides: {},
      customGroups: [],
    });
  });

  it('adds, edits and removes custom groups', () => {
    const store = useSceneryPrefsStore.getState();
    const id = store.addCustomGroup(XP, { name: 'Mine', members: ['A'] });
    store.updateCustomGroup(XP, id, { rule: { mode: 'prefix', pattern: 'Orbx' } });
    let groups = sceneryPrefsFor(useSceneryPrefsStore.getState(), XP).customGroups;
    expect(groups).toEqual([
      { id, name: 'Mine', members: ['A'], rule: { mode: 'prefix', pattern: 'Orbx' } },
    ]);
    store.removeCustomGroup(XP, id);
    groups = sceneryPrefsFor(useSceneryPrefsStore.getState(), XP).customGroups;
    expect(groups).toEqual([]);
  });
});
