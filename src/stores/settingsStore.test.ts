import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the renderer-only `window.appAPI` that settingsStore touches via
// `applyZoomLevel` on rehydrate / reset. Has to happen before importing the
// store so the persist middleware sees the stub.
vi.stubGlobal('window', {
  appAPI: { setZoomFactor: vi.fn() },
  matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
});
Object.defineProperty(globalThis, 'document', {
  value: { documentElement: { style: {} } },
  configurable: true,
});

const { migrateSettings, useSettingsStore } = await import('./settingsStore');

describe('migrateSettings', () => {
  it('seeds userMapStyles when migrating from a fresh install (version < 6)', () => {
    // Pre-v6 state had a different shape entirely; migrate replaces it with
    // defaults, which must include userMapStyles after the v20 step.
    const result = migrateSettings({}, 5);
    expect(result.map.userMapStyles).toEqual([]);
  });

  it('migrates a v18 persisted blob all the way to v20 in a single call', () => {
    // Regression: the previous early-return pattern stopped at the first
    // matching `if (version < N)` branch, so anyone on v18 never reached the
    // v20 step and ended up with `userMapStyles` undefined at runtime.
    const v18Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        idleOrbitEnabled: false,
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '' },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        taxiwayLightGlow: true,
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v18Blob, 18);
    expect(result.map.userMapStyles).toEqual([]);
    // Existing fields preserved
    expect(result.map.mapStyleUrl).toBe(
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    );
    expect(result.appearance.fontSize).toBe('medium');
  });

  it('rolls forward dropped style URLs at v19 and still adds userMapStyles at v20', () => {
    const v18Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://tiles.openfreemap.org/styles/bright', // dropped at v19
        idleOrbitEnabled: false,
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '' },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        taxiwayLightGlow: true,
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v18Blob, 18);
    expect(result.map.mapStyleUrl).toBe(
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    );
    expect(result.map.userMapStyles).toEqual([]);
  });

  it('preserves existing userMapStyles when running from a v19 blob that already has them', () => {
    // Edge case: a future user already has userMapStyles populated from a
    // sibling branch — we shouldn't overwrite them.
    const v19Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        idleOrbitEnabled: false,
        units: { weight: 'lbs' as const },
        userMapStyles: [
          { id: 'user-existing', name: 'Existing', url: 'https://example.com/style.json' },
        ],
      },
      simbrief: { pilotId: '' },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        taxiwayLightGlow: true,
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v19Blob, 19);
    expect(result.map.userMapStyles).toHaveLength(1);
    expect(result.map.userMapStyles[0]?.id).toBe('user-existing');
  });
});

describe('userMapStyles actions', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('addUserMapStyle accepts a valid raster URL', () => {
    useSettingsStore.getState().addUserMapStyle({
      id: 'u1',
      name: 'Test',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
    expect(useSettingsStore.getState().map.userMapStyles).toHaveLength(1);
  });

  it('addUserMapStyle rejects an invalid URL at the action boundary', () => {
    useSettingsStore.getState().addUserMapStyle({
      id: 'u-bad',
      name: 'Garbage',
      url: 'not a url',
    });
    expect(useSettingsStore.getState().map.userMapStyles).toHaveLength(0);
  });

  it('addUserMapStyle dedupes by URL', () => {
    const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const { addUserMapStyle } = useSettingsStore.getState();
    addUserMapStyle({ id: 'u1', name: 'A', url });
    addUserMapStyle({ id: 'u2', name: 'B', url });
    expect(useSettingsStore.getState().map.userMapStyles).toHaveLength(1);
    expect(useSettingsStore.getState().map.userMapStyles[0]?.id).toBe('u1');
  });

  it('removeUserMapStyle falls back to the default style when removing the active selection', () => {
    const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const { addUserMapStyle, updateMapSettings, removeUserMapStyle } = useSettingsStore.getState();
    addUserMapStyle({ id: 'u1', name: 'A', url });
    updateMapSettings({ mapStyleUrl: url });
    expect(useSettingsStore.getState().map.mapStyleUrl).toBe(url);

    removeUserMapStyle('u1');
    expect(useSettingsStore.getState().map.userMapStyles).toHaveLength(0);
    // Default preset is the dark CARTO style (carto-dark).
    expect(useSettingsStore.getState().map.mapStyleUrl).toBe(
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    );
  });

  it('removeUserMapStyle leaves the active selection alone when removing a non-active style', () => {
    const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const presetUrl = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    const { addUserMapStyle, updateMapSettings, removeUserMapStyle } = useSettingsStore.getState();
    addUserMapStyle({ id: 'u1', name: 'A', url });
    updateMapSettings({ mapStyleUrl: presetUrl });

    removeUserMapStyle('u1');
    expect(useSettingsStore.getState().map.mapStyleUrl).toBe(presetUrl);
  });
});
