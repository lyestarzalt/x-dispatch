import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the renderer-only `window.appAPI` that settingsStore touches via
// `applyZoomLevel` on rehydrate / reset. Has to happen before importing the
// store so the persist middleware sees the stub.
vi.stubGlobal('window', {
  appAPI: { setZoomFactor: vi.fn() },
  matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(() => null),
    length: 0,
  },
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
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v18Blob, 18);
    expect(result.map.userMapStyles).toEqual([]);
    // CARTO Dark Matter moves to its OpenFreeMap equivalent at v32
    expect(result.map.mapStyleUrl).toBe('https://tiles.openfreemap.org/styles/dark');
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
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v18Blob, 18);
    // Rolled to CARTO Positron at v19, then to OpenFreeMap Positron at v32
    expect(result.map.mapStyleUrl).toBe('https://tiles.openfreemap.org/styles/positron');
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
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v19Blob, 19);
    expect(result.map.userMapStyles).toHaveLength(1);
    expect(result.map.userMapStyles[0]?.id).toBe('user-existing');
  });

  it('adds the sky and night defaults at v25 without touching existing graphics choices', () => {
    const v24Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        idleOrbitEnabled: false,
        userMapStyles: [],
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: false,
        surfaceDetail: 'low' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v24Blob, 24);
    expect(result.graphics).toEqual({
      approachLightAnimation: false,
      dynamicSky: true,
      cityLights: true,
      followSimTime: true,
      groundWeather: true,
      airfieldLights: 'on',
      ownshipSize: 'medium',
      ownshipColor: 'magenta',
      ownshipAltitudeCues: true,
    });
  });

  it('drops the surface detail choice at v35 and keeps the other graphics settings', () => {
    const v34Blob = {
      map: { userMapStyles: [], units: { weight: 'lbs' as const } },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: false,
        surfaceDetail: 'low',
        dynamicSky: true,
        cityLights: false,
        followSimTime: true,
        groundWeather: true,
        airfieldLights: 'on' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
      desktop: {},
    };
    const result = migrateSettings(v34Blob, 34);
    expect(result.graphics).toEqual({
      approachLightAnimation: false,
      dynamicSky: true,
      cityLights: false,
      followSimTime: true,
      groundWeather: true,
      airfieldLights: 'on',
      ownshipSize: 'medium',
      ownshipColor: 'magenta',
      ownshipAltitudeCues: true,
    });
    expect('surfaceDetail' in result.graphics).toBe(false);
  });

  it('adds the own-aircraft symbol size and colours at v38 and keeps the other graphics settings', () => {
    const v37Blob = {
      map: { userMapStyles: [], units: { weight: 'lbs' as const } },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: false,
        dynamicSky: true,
        cityLights: false,
        followSimTime: true,
        groundWeather: false,
        airfieldLights: 'off' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
      desktop: {},
      flightStrip: { scale: 1, opacity: 1 },
    };
    const result = migrateSettings(v37Blob, 37);
    expect(result.graphics).toEqual({
      ...v37Blob.graphics,
      ownshipSize: 'medium',
      ownshipColor: 'magenta',
      ownshipAltitudeCues: true,
    });
  });

  it('adds the image basemap label settings at v36 and keeps the other map choices', () => {
    const v35Blob = {
      map: { userMapStyles: [], idleOrbitEnabled: true, units: { weight: 'lbs' as const } },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {},
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
      desktop: {},
    };
    const result = migrateSettings(v35Blob, 35);
    expect(result.map.idleOrbitEnabled).toBe(true);
    expect(result.map.referenceLabels).toEqual({
      show: {
        borders: true,
        countries: true,
        states: true,
        cities: true,
        towns: true,
        water: true,
        roads: true,
      },
      brightness: 1,
      sizeScale: 1,
    });
  });

  it('adds flight recorder defaults at v26 and keeps earlier sections', () => {
    const v25Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        idleOrbitEnabled: false,
        userMapStyles: [],
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        surfaceDetail: 'high' as const,
        dynamicSky: false,
        cityLights: true,
        followSimTime: true,
      },
      launcher: { closeOnLaunch: true, customLaunchArgs: [] },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v25Blob, 25);
    expect(result.flights).toEqual({
      recording: true,
      landingReport: true,
      landingFlyTo: true,
      landingNotification: true,
    });
    expect(result.graphics.dynamicSky).toBe(false);
    expect(result.launcher.closeOnLaunch).toBe(true);
  });

  it('seeds an empty fmsExportTargets array when migrating from v20 to v21', () => {
    const v20Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        userMapStyles: [],
        idleOrbitEnabled: false,
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '1234567' },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v20Blob, 20);
    expect(result.simbrief.fmsExportTargets).toEqual([]);
    expect(result.simbrief.pilotId).toBe('1234567');
  });

  it('seeds default airports settings when migrating from v21 to v22', () => {
    const v21Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        userMapStyles: [],
        idleOrbitEnabled: false,
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '1234567', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        surfaceDetail: 'high' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
    };
    const result = migrateSettings(v21Blob, 21);
    expect(result.airports).toEqual({
      favoriteIcaos: [],
      homeIcao: null,
      autoNavigateHomeOnStart: true,
    });
    // Pre-existing fields untouched.
    expect(result.simbrief.pilotId).toBe('1234567');
  });
  it('adds the toolbar clock mode at v28 and keeps existing appearance choices', () => {
    const v27Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        idleOrbitEnabled: false,
        userMapStyles: [],
        units: { weight: 'lbs' as const },
      },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'large' as const, zoomLevel: 1.1, debugOverlay: true },
      graphics: {
        approachLightAnimation: true,
        surfaceDetail: 'high' as const,
        dynamicSky: true,
        cityLights: true,
        followSimTime: false,
        groundWeather: true,
        airfieldLights: 'on' as const,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      flights: { recording: true, landingReport: true, landingFlyTo: true },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v27Blob, 27);
    expect(result.appearance).toEqual({
      fontSize: 'large',
      zoomLevel: 1.1,
      debugOverlay: true,
      clockMode: 'zulu',
    });
    expect(result.flightStrip.scale).toBe(1);
    expect(result.graphics.followSimTime).toBe(false);
  });

  it('moves the strip size and opacity into their own settings at v37', () => {
    const v36Blob = {
      appearance: {
        fontSize: 'medium' as const,
        zoomLevel: 1.2,
        debugOverlay: false,
        clockMode: 'local' as const,
        flightStripScale: 1.4,
        flightStripOpacity: 0.6,
      },
      airports: { favoriteIcaos: ['LFPG'], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v36Blob, 36);
    expect(result.flightStrip).toEqual({
      scale: 1.4,
      opacity: 0.6,
      locked: false,
      alwaysOnTop: true,
      autoOpen: false,
      fields: {
        aircraft: true,
        attitude: true,
        speed: true,
        altitude: true,
        verticalSpeed: true,
        heading: true,
        wind: true,
        com1: false,
        qnh: false,
        targets: true,
        details: true,
      },
      order: ['attitude', 'speed', 'altitude', 'verticalSpeed', 'heading', 'wind', 'com1', 'qnh'],
    });
    expect(result.appearance).toEqual({
      fontSize: 'medium',
      zoomLevel: 1.2,
      debugOverlay: false,
      clockMode: 'local',
    });
    expect(result.airports.favoriteIcaos).toEqual(['LFPG']);
  });

  it('gives the strip defaults at v37 when the old values are missing or broken', () => {
    const result = migrateSettings({ appearance: { flightStripScale: 'big' } }, 36);
    expect(result.flightStrip.scale).toBe(1);
    expect(result.flightStrip.opacity).toBe(1);
  });

  it('adds the desktop window settings at v34 with every behaviour on', () => {
    const v33Blob = {
      appearance: { fontSize: 'medium', zoomLevel: 1, flightStripOpacity: 1 },
      airports: { favoriteIcaos: ['DAAG'], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v33Blob, 33);
    expect(result.desktop).toEqual({
      keepRunningOnClose: true,
      attention: true,
      recentAirportsMenu: true,
    });
    expect(result.airports.favoriteIcaos).toEqual(['DAAG']);
  });

  it('adds the five new unit preferences at v29 while preserving the existing weight choice', () => {
    const v28Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        userMapStyles: [],
        idleOrbitEnabled: false,
        units: { weight: 'kg' as const }, // user had already switched this
      },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: {
        fontSize: 'medium' as const,
        zoomLevel: 1.0,
        debugOverlay: false,
        clockMode: 'zulu' as const,
      },
      graphics: {},
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      flights: { recording: true, landingReport: true, landingFlyTo: true },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v28Blob, 28);
    expect(result.map.units).toEqual({
      distance: 'nm',
      altitude: 'ft',
      speed: 'kts',
      verticalSpeed: 'fpm',
      weight: 'kg', // preserved, not reset to the default 'lbs'
      coordinates: 'decimal',
      course: 'magnetic', // cascaded forward from the v30 step in the same call
    });
  });

  it('adds the course preference at v30, preserving the other five unit preferences', () => {
    const v29Blob = {
      map: {
        navDataRadiusNm: 100,
        vatsimRefreshInterval: 15,
        mapStyleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        userMapStyles: [],
        idleOrbitEnabled: false,
        units: {
          distance: 'km' as const, // user had already switched these
          altitude: 'm' as const,
          speed: 'kmh' as const,
          verticalSpeed: 'ms' as const,
          weight: 'kg' as const,
          coordinates: 'dms' as const,
        },
      },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: {
        fontSize: 'medium' as const,
        zoomLevel: 1.0,
        debugOverlay: false,
        clockMode: 'zulu' as const,
      },
      graphics: {},
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      flights: { recording: true, landingReport: true, landingFlyTo: true },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
    };
    const result = migrateSettings(v29Blob, 29);
    expect(result.map.units).toEqual({
      distance: 'km',
      altitude: 'm',
      speed: 'kmh',
      verticalSpeed: 'ms',
      weight: 'kg',
      coordinates: 'dms',
      course: 'magnetic',
    });
  });
});

describe('Airport favorites/home actions', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('toggleFavoriteAirport adds then removes the same ICAO', () => {
    const { toggleFavoriteAirport } = useSettingsStore.getState();
    toggleFavoriteAirport('kjfk');
    expect(useSettingsStore.getState().airports.favoriteIcaos).toEqual(['KJFK']);
    toggleFavoriteAirport('KJFK');
    expect(useSettingsStore.getState().airports.favoriteIcaos).toEqual([]);
  });

  it('toggleFavoriteAirport preserves insertion order', () => {
    const { toggleFavoriteAirport } = useSettingsStore.getState();
    toggleFavoriteAirport('KJFK');
    toggleFavoriteAirport('EGLL');
    toggleFavoriteAirport('LFPG');
    expect(useSettingsStore.getState().airports.favoriteIcaos).toEqual(['KJFK', 'EGLL', 'LFPG']);
  });

  it('setHomeAirport sets and clears, normalizing to uppercase', () => {
    const { setHomeAirport } = useSettingsStore.getState();
    setHomeAirport('eham');
    expect(useSettingsStore.getState().airports.homeIcao).toBe('EHAM');
    setHomeAirport(null);
    expect(useSettingsStore.getState().airports.homeIcao).toBeNull();
  });

  it('home and favorites are independent — removing from favorites does not clear home', () => {
    const { toggleFavoriteAirport, setHomeAirport, removeFavoriteAirport } =
      useSettingsStore.getState();
    toggleFavoriteAirport('KJFK');
    setHomeAirport('KJFK');
    removeFavoriteAirport('KJFK');
    expect(useSettingsStore.getState().airports.favoriteIcaos).toEqual([]);
    expect(useSettingsStore.getState().airports.homeIcao).toBe('KJFK');
  });

  it('updateAirportsSettings patches the autoNavigateHomeOnStart toggle', () => {
    useSettingsStore.getState().updateAirportsSettings({ autoNavigateHomeOnStart: false });
    expect(useSettingsStore.getState().airports.autoNavigateHomeOnStart).toBe(false);
  });
});

describe('FMS export target actions', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
  });

  it('adds a target with a generated id', () => {
    const id = useSettingsStore.getState().addFmsExportTarget({
      formatKey: 'xpn',
      label: 'Default X-Plane 12 (.fms)',
      folderPath: '/Users/x/X-Plane 12/Output/FMS plans',
    });
    const targets = useSettingsStore.getState().simbrief.fmsExportTargets;
    expect(targets).toHaveLength(1);
    expect(targets[0]!.id).toBe(id);
    expect(targets[0]!.formatKey).toBe('xpn');
  });

  it('updates a target by id', () => {
    const { addFmsExportTarget, updateFmsExportTarget } = useSettingsStore.getState();
    const id = addFmsExportTarget({
      formatKey: 'tfd',
      label: 'ToLiss',
      folderPath: '/old/path',
    });
    updateFmsExportTarget(id, { folderPath: '/new/path' });
    const target = useSettingsStore.getState().simbrief.fmsExportTargets[0]!;
    expect(target.folderPath).toBe('/new/path');
    expect(target.label).toBe('ToLiss');
  });

  it('removes a target by id', () => {
    const { addFmsExportTarget, removeFmsExportTarget } = useSettingsStore.getState();
    const id = addFmsExportTarget({
      formatKey: 'zbo',
      label: 'Zibo 737',
      folderPath: '/path/to/zibo',
    });
    removeFmsExportTarget(id);
    expect(useSettingsStore.getState().simbrief.fmsExportTargets).toHaveLength(0);
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
    expect(useSettingsStore.getState().map.mapStyleUrl).toBe(
      'https://tiles.openfreemap.org/styles/dark'
    );
  });

  it('removeUserMapStyle leaves the active selection alone when removing a non-active style', () => {
    const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const presetUrl = 'https://tiles.openfreemap.org/styles/positron';
    const { addUserMapStyle, updateMapSettings, removeUserMapStyle } = useSettingsStore.getState();
    addUserMapStyle({ id: 'u1', name: 'A', url });
    updateMapSettings({ mapStyleUrl: presetUrl });

    removeUserMapStyle('u1');
    expect(useSettingsStore.getState().map.mapStyleUrl).toBe(presetUrl);
  });
});

describe('flight strip settings', () => {
  beforeEach(() => useSettingsStore.getState().resetToDefaults());

  it('never hides the last readout', () => {
    const { setFlightStripField } = useSettingsStore.getState();
    for (const field of ['attitude', 'speed', 'altitude', 'verticalSpeed', 'heading'] as const) {
      setFlightStripField(field, false);
    }
    setFlightStripField('wind', false);
    expect(useSettingsStore.getState().flightStrip.fields.wind).toBe(true);
  });

  it('toggles the lock', () => {
    useSettingsStore.getState().toggleFlightStripLock();
    expect(useSettingsStore.getState().flightStrip.locked).toBe(true);
    useSettingsStore.getState().toggleFlightStripLock();
    expect(useSettingsStore.getState().flightStrip.locked).toBe(false);
  });

  it('reorders the readouts and repairs a broken order', () => {
    useSettingsStore.getState().setFlightStripOrder(['wind', 'speed', 'wind'] as never);
    expect(useSettingsStore.getState().flightStrip.order.slice(0, 3)).toEqual([
      'wind',
      'speed',
      'attitude',
    ]);
  });

  it('clamps size and opacity', () => {
    const { setFlightStripScale, setFlightStripOpacity } = useSettingsStore.getState();
    setFlightStripScale(5);
    setFlightStripOpacity(0);
    expect(useSettingsStore.getState().flightStrip).toMatchObject({ scale: 2, opacity: 0.3 });
  });
});

describe('own-aircraft colour at v39', () => {
  it('replaces a scheme that no longer exists with the default and keeps a known one', () => {
    const blob = (ownshipColor: string) => ({
      map: { userMapStyles: [], units: { weight: 'lbs' as const } },
      simbrief: { pilotId: '', fmsExportTargets: [] },
      appearance: { fontSize: 'medium' as const, zoomLevel: 1.0, debugOverlay: false },
      graphics: {
        approachLightAnimation: true,
        dynamicSky: true,
        cityLights: true,
        followSimTime: true,
        groundWeather: true,
        airfieldLights: 'on' as const,
        ownshipSize: 'large' as const,
        ownshipColor,
        ownshipAltitudeCues: false,
      },
      launcher: { closeOnLaunch: false, customLaunchArgs: [] },
      support: { promptDismissed: false },
      airports: { favoriteIcaos: [], homeIcao: null, autoNavigateHomeOnStart: true },
      desktop: {},
      flightStrip: { scale: 1, opacity: 1 },
    });
    expect(migrateSettings(blob('cyanOutline'), 38).graphics).toMatchObject({
      ownshipColor: 'magenta',
      ownshipSize: 'large',
      ownshipAltitudeCues: false,
    });
    // Orange became red in v41; the cascade carries a v38 blob through that step too.
    expect(migrateSettings(blob('orange'), 38).graphics.ownshipColor).toBe('red');
    expect(migrateSettings(blob('orange'), 40).graphics.ownshipColor).toBe('red');
    expect(migrateSettings(blob('white'), 40).graphics.ownshipColor).toBe('white');
  });
});
