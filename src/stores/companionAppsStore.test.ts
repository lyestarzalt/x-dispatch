import { beforeEach, describe, expect, it } from 'vitest';
import { useCompanionAppsStore } from './companionAppsStore';

describe('companionAppsStore', () => {
  beforeEach(() => {
    useCompanionAppsStore.setState({ tools: [] });
  });

  it('starts with an empty tools list', () => {
    expect(useCompanionAppsStore.getState().tools).toEqual([]);
  });
});
