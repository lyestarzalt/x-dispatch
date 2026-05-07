import { beforeEach, describe, expect, it } from 'vitest';
import { useCompanionAppsStore } from './companionAppsStore';

describe('companionAppsStore', () => {
  beforeEach(() => {
    useCompanionAppsStore.setState({ tools: [] });
  });

  it('starts with an empty tools list', () => {
    expect(useCompanionAppsStore.getState().tools).toEqual([]);
  });

  describe('addTool', () => {
    it('adds a tool with a generated id', () => {
      useCompanionAppsStore.getState().addTool({
        name: 'XPME',
        exePath: '/Applications/XPME.app',
        autoLaunch: false,
        delayBeforeXPlaneSec: 10,
      });
      const tools = useCompanionAppsStore.getState().tools;
      expect(tools).toHaveLength(1);
      expect(tools[0]!.id).toBeTruthy();
      expect(tools[0]!.name).toBe('XPME');
      expect(tools[0]!.delayBeforeXPlaneSec).toBe(10);
    });

    it('preserves existing tools when adding', () => {
      const { addTool } = useCompanionAppsStore.getState();
      addTool({ name: 'A', exePath: '/a', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      addTool({ name: 'B', exePath: '/b', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      expect(useCompanionAppsStore.getState().tools).toHaveLength(2);
    });
  });

  describe('updateTool', () => {
    it('updates fields by id', () => {
      const { addTool, updateTool } = useCompanionAppsStore.getState();
      addTool({ name: 'X', exePath: '/x', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      const id = useCompanionAppsStore.getState().tools[0]!.id;
      updateTool(id, { autoLaunch: true, delayBeforeXPlaneSec: 5 });
      const updated = useCompanionAppsStore.getState().tools[0]!;
      expect(updated.autoLaunch).toBe(true);
      expect(updated.delayBeforeXPlaneSec).toBe(5);
      expect(updated.name).toBe('X'); // unchanged
    });

    it('does nothing if id not found', () => {
      const { addTool, updateTool } = useCompanionAppsStore.getState();
      addTool({ name: 'X', exePath: '/x', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      const before = useCompanionAppsStore.getState().tools[0]!;
      updateTool('non-existent', { autoLaunch: true });
      const after = useCompanionAppsStore.getState().tools[0]!;
      expect(after).toEqual(before);
    });
  });

  describe('removeTool', () => {
    it('removes a tool by id', () => {
      const { addTool, removeTool } = useCompanionAppsStore.getState();
      addTool({ name: 'X', exePath: '/x', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      const id = useCompanionAppsStore.getState().tools[0]!.id;
      removeTool(id);
      expect(useCompanionAppsStore.getState().tools).toEqual([]);
    });

    it('keeps other tools when removing one', () => {
      const { addTool, removeTool } = useCompanionAppsStore.getState();
      addTool({ name: 'A', exePath: '/a', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      addTool({ name: 'B', exePath: '/b', autoLaunch: false, delayBeforeXPlaneSec: 0 });
      const idA = useCompanionAppsStore.getState().tools[0]!.id;
      removeTool(idA);
      const remaining = useCompanionAppsStore.getState().tools;
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.name).toBe('B');
    });
  });
});
