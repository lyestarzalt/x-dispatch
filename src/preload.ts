import { IpcRendererEvent, contextBridge, ipcRenderer, webFrame, webUtils } from 'electron';
import type { AirportProcedures } from './lib/parsers/nav/cifpParser';
import type { FlightInit } from './lib/xplaneServices/client/generated/xplaneApi';
import type { Airport, DataLoadStatus } from './lib/xplaneServices/dataService/XPlaneDataManager';
import type { NavDataSources } from './lib/xplaneServices/dataService/cycleInfo';
// Import types from canonical sources
import type { Aircraft, WeatherPreset } from './types/aircraft';
import type {
  ApiResponse,
  BrowseResult,
  NavDBStatus,
  NavLoadResult,
  NavSearchResult,
  PathSetResult,
  PathValidation,
} from './types/ipc';
import type { IvaoData } from './types/ivao';
import type {
  ATCController,
  AirportMetadata,
  Airspace,
  HoldingPattern,
  Navaid,
  Waypoint,
} from './types/navigation';
import type { AirwaySegmentWithCoords } from './types/navigation';
import type { VatsimData, VatsimEventsResponse } from './types/vatsim';
import type { LoadingProgress, PlaneState, XPlaneAPIResult } from './types/xplane';

contextBridge.exposeInMainWorld('airportAPI', {
  getAirports: () => ipcRenderer.invoke('get-airports'),
  getDistinctCountries: () => ipcRenderer.invoke('data:getDistinctCountries'),
  getAirportData: (icao: string) => ipcRenderer.invoke('get-airport-data', icao),
  fetchMetar: (icao: string) => ipcRenderer.invoke('fetch-metar', icao),
  fetchTaf: (icao: string) => ipcRenderer.invoke('fetch-taf', icao),
  fetchGatewayReleases: () => ipcRenderer.invoke('fetch-gateway-releases'),
  fetchGatewayReleasePacks: (version: string) =>
    ipcRenderer.invoke('fetch-gateway-release-packs', version),
  fetchGatewayAirport: (icao: string) => ipcRenderer.invoke('fetch-gateway-airport', icao),
  fetchGatewayScenery: (sceneryId: number) =>
    ipcRenderer.invoke('fetch-gateway-scenery', sceneryId),
  fetchVatsimData: () => ipcRenderer.invoke('fetch-vatsim-data'),
  fetchVatsimMetar: (icao: string) => ipcRenderer.invoke('fetch-vatsim-metar', icao),
  fetchVatsimEvents: () => ipcRenderer.invoke('fetch-vatsim-events'),
  fetchIvaoData: () => ipcRenderer.invoke('fetch-ivao-data'),
});

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title: string) => ipcRenderer.send('set-title', title),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  onUpdateCounter: (callback: (value: number) => void) =>
    ipcRenderer.on('update-counter', (_event, value: number) => callback(value)),
});

contextBridge.exposeInMainWorld('appAPI', {
  isSetupComplete: () => ipcRenderer.invoke('app:isSetupComplete'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getProcessMemory: () =>
    ipcRenderer.invoke('app:getProcessMemory') as Promise<{
      rss: number;
      heapUsed: number;
      heapTotal: number;
    }>,
  startLoading: () => ipcRenderer.invoke('app:startLoading'),
  getLoadingStatus: () => ipcRenderer.invoke('app:getLoadingStatus'),
  clearCache: () => ipcRenderer.invoke('app:clearCache'),
  onLoadingProgress: (callback: (progress: LoadingProgress) => void) => {
    const handler = (_event: IpcRendererEvent, progress: LoadingProgress) => callback(progress);
    ipcRenderer.on('loading-progress', handler);
    return () => ipcRenderer.removeListener('loading-progress', handler);
  },
  log: {
    error: (message: string, ...args: unknown[]) => ipcRenderer.send('log:error', message, args),
    warn: (message: string, ...args: unknown[]) => ipcRenderer.send('log:warn', message, args),
    info: (message: string, ...args: unknown[]) => ipcRenderer.send('log:info', message, args),
  },
  getLogPath: () => ipcRenderer.invoke('app:getLogPath'),
  openLogFile: () => ipcRenderer.invoke('app:openLogFile'),
  openLogFolder: () => ipcRenderer.invoke('app:openLogFolder'),
  getConfigPath: () => ipcRenderer.invoke('app:getConfigPath'),
  openConfigFolder: () => ipcRenderer.invoke('app:openConfigFolder'),
  openPath: (path: string) => ipcRenderer.invoke('app:openPath', path),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  getSendCrashReports: () => ipcRenderer.invoke('app:getSendCrashReports'),
  setSendCrashReports: (enabled: boolean) => ipcRenderer.invoke('app:setSendCrashReports', enabled),
  getXPlaneVersion: () => ipcRenderer.invoke('app:getXPlaneVersion'),
  getTileCacheStats: () => ipcRenderer.invoke('app:getTileCacheStats'),
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),
  getFilePathForDrop: (file: File) => webUtils.getPathForFile(file),
  onFocusSearch: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('focus-search', handler);
    return () => ipcRenderer.removeListener('focus-search', handler);
  },
  resyncCustomAirports: () =>
    ipcRenderer.invoke('airport:resync-custom') as Promise<{
      synced: boolean;
      count: number;
      diff: number;
    }>,
  onAirportsUpdated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('airports-updated', handler);
    return () => ipcRenderer.removeListener('airports-updated', handler);
  },
  onDeepLink: (callback: (data: { type: string; icao?: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { type: string; icao?: string }) =>
      callback(data);
    ipcRenderer.on('deep-link', handler);
    return () => ipcRenderer.removeListener('deep-link', handler);
  },
});

contextBridge.exposeInMainWorld('xplaneAPI', {
  getPath: () => ipcRenderer.invoke('xplane:getPath'),
  setPath: (path: string) => ipcRenderer.invoke('xplane:setPath', path),
  changePath: (path: string) => ipcRenderer.invoke('xplane:changePath', path),
  validatePath: (path: string) => ipcRenderer.invoke('xplane:validatePath', path),
  detectInstallations: () => ipcRenderer.invoke('xplane:detectInstallations'),
  browseForPath: () => ipcRenderer.invoke('xplane:browseForPath'),
  // Multi-installation management
  getInstallations: () => ipcRenderer.invoke('xplane:getInstallations'),
  getActiveInstallation: () => ipcRenderer.invoke('xplane:getActiveInstallation'),
  addInstallation: (name: string, path: string) =>
    ipcRenderer.invoke('xplane:addInstallation', name, path),
  removeInstallation: (id: string) => ipcRenderer.invoke('xplane:removeInstallation', id),
  renameInstallation: (id: string, name: string) =>
    ipcRenderer.invoke('xplane:renameInstallation', id, name),
  switchInstallation: (id: string) => ipcRenderer.invoke('xplane:switchInstallation', id),
});

contextBridge.exposeInMainWorld('navAPI', {
  loadDatabase: (xplanePath?: string) => ipcRenderer.invoke('nav:loadDatabase', xplanePath),
  getStatus: () => ipcRenderer.invoke('nav:getStatus'),
  getVORsInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getVORsInRadius', lat, lon, radiusNm),
  getNDBsInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getNDBsInRadius', lat, lon, radiusNm),
  getDMEsInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getDMEsInRadius', lat, lon, radiusNm),
  getILSInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getILSInRadius', lat, lon, radiusNm),
  getWaypointsInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getWaypointsInRadius', lat, lon, radiusNm),
  getAirspacesNearPoint: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getAirspacesNearPoint', lat, lon, radiusNm),
  getAllAirspaces: () => ipcRenderer.invoke('nav:getAllAirspaces'),
  getAirwaySegments: (airwayName: string) =>
    ipcRenderer.invoke('nav:getAirwaySegments', airwayName),
  getGlideSlopesInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getGlideSlopesInRadius', lat, lon, radiusNm),
  getMarkersInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getMarkersInRadius', lat, lon, radiusNm),
  getILSComponentsInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getILSComponentsInRadius', lat, lon, radiusNm),
  getApproachAidsInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getApproachAidsInRadius', lat, lon, radiusNm),
  getApproachNavaidsByAirport: (airportIcao: string) =>
    ipcRenderer.invoke('nav:getApproachNavaidsByAirport', airportIcao),
  getApproachNavaidsByRunway: (airportIcao: string, runway: string) =>
    ipcRenderer.invoke('nav:getApproachNavaidsByRunway', airportIcao, runway),
  searchNavaids: (query: string, limit?: number) =>
    ipcRenderer.invoke('nav:searchNavaids', query, limit),
  getAirportProcedures: (icao: string) => ipcRenderer.invoke('nav:getAirportProcedures', icao),
  // New API methods
  getDataSources: () => ipcRenderer.invoke('nav:getDataSources'),
  getATCByFacility: (facilityId: string) => ipcRenderer.invoke('nav:getATCByFacility', facilityId),
  getAllATCControllers: () => ipcRenderer.invoke('nav:getAllATCControllers'),
  getHoldingPatterns: (fixId: string) => ipcRenderer.invoke('nav:getHoldingPatterns', fixId),
  getAirportMetadata: (icao: string) => ipcRenderer.invoke('nav:getAirportMetadata', icao),
  getTransitionAltitude: (icao: string) => ipcRenderer.invoke('nav:getTransitionAltitude', icao),
  // Bulk data retrieval for map layers
  getAllHoldingPatterns: () => ipcRenderer.invoke('nav:getAllHoldingPatterns'),
  // Bounds-based queries (SQLite direct - more efficient)
  getNavaidsInBounds: (
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    types?: string[],
    limit?: number
  ) => ipcRenderer.invoke('nav:getNavaidsInBounds', minLat, maxLat, minLon, maxLon, types, limit),
  getWaypointsInBounds: (
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    limit?: number
  ) => ipcRenderer.invoke('nav:getWaypointsInBounds', minLat, maxLat, minLon, maxLon, limit),
  resolveWaypointCoords: (
    waypointId: string,
    region?: string,
    airportLat?: number,
    airportLon?: number
  ) => ipcRenderer.invoke('nav:resolveWaypointCoords', waypointId, region, airportLat, airportLon),
  resolveNavaidCoords: (
    navaidId: string,
    region?: string,
    airportLat?: number,
    airportLon?: number
  ) => ipcRenderer.invoke('nav:resolveNavaidCoords', navaidId, region, airportLat, airportLon),
});

contextBridge.exposeInMainWorld('launcherAPI', {
  scanAircraft: () => ipcRenderer.invoke('launcher:scanAircraft'),
  getAircraft: () => ipcRenderer.invoke('launcher:getAircraft'),
  getWeatherPresets: () => ipcRenderer.invoke('launcher:getWeatherPresets'),
  launch: (payload: FlightInit) => ipcRenderer.invoke('launcher:launch', payload),
  getAircraftImage: (imagePath: string) =>
    ipcRenderer.invoke('launcher:getAircraftImage', imagePath),
});

contextBridge.exposeInMainWorld('flightPlanAPI', {
  openFile: () => ipcRenderer.invoke('flightplan:openFile'),
  enrich: (fmsData: import('./types/fms').FMSFlightPlan) =>
    ipcRenderer.invoke('flightplan:enrich', fmsData),
});

contextBridge.exposeInMainWorld('simbriefAPI', {
  fetchLatest: (pilotId: string) => ipcRenderer.invoke('simbrief:fetchLatest', pilotId),
});

// X-Plane Service API - REST + WebSocket
// REST goes through IPC to main process to avoid CORS issues with localhost
contextBridge.exposeInMainWorld('xplaneServiceAPI', {
  // REST API (via main process)
  isAPIAvailable: () => ipcRenderer.invoke('xplaneService:isAPIAvailable'),
  getCapabilities: () => ipcRenderer.invoke('xplaneService:getCapabilities'),
  startFlight: (payload: unknown) => ipcRenderer.invoke('xplaneService:startFlight', payload),
  getDataref: (name: string) => ipcRenderer.invoke('xplaneService:getDataref', name),
  setDataref: (name: string, value: number | number[]) =>
    ipcRenderer.invoke('xplaneService:setDataref', name, value),
  activateCommand: (name: string, duration?: number) =>
    ipcRenderer.invoke('xplaneService:activateCommand', name, duration ?? 0),
  // WebSocket streaming
  startStateStream: () => ipcRenderer.invoke('xplaneService:startStateStream'),
  stopStateStream: () => ipcRenderer.invoke('xplaneService:stopStateStream'),
  forceReconnect: () => ipcRenderer.invoke('xplaneService:forceReconnect'),
  isStreamConnected: () => ipcRenderer.invoke('xplaneService:isStreamConnected'),
  onStateUpdate: (callback: (state: PlaneState) => void) => {
    const listener = (_: IpcRendererEvent, state: PlaneState) => callback(state);
    ipcRenderer.on('xplaneService:stateUpdate', listener);
    return () => ipcRenderer.removeListener('xplaneService:stateUpdate', listener);
  },
  onConnectionChange: (callback: (connected: boolean) => void) => {
    const listener = (_: IpcRendererEvent, connected: boolean) => callback(connected);
    ipcRenderer.on('xplaneService:connectionChange', listener);
    return () => ipcRenderer.removeListener('xplaneService:connectionChange', listener);
  },
  onStateClear: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('xplaneService:stateClear', listener);
    return () => ipcRenderer.removeListener('xplaneService:stateClear', listener);
  },
});

// Addon Manager API
contextBridge.exposeInMainWorld('addonManagerAPI', {
  scenery: {
    analyze: () => ipcRenderer.invoke('addon:scenery:analyze'),
    sort: () => ipcRenderer.invoke('addon:scenery:sort'),
    saveOrder: (folderNames: string[]) =>
      ipcRenderer.invoke('addon:scenery:saveOrder', folderNames),
    toggle: (folderName: string) => ipcRenderer.invoke('addon:scenery:toggle', folderName),
    deleteScenery: (folderName: string) => ipcRenderer.invoke('addon:scenery:delete', folderName),
    move: (folderName: string, direction: 'up' | 'down') =>
      ipcRenderer.invoke('addon:scenery:move', folderName, direction),
    backup: () => ipcRenderer.invoke('addon:scenery:backup'),
    listBackups: () => ipcRenderer.invoke('addon:scenery:listBackups'),
    restore: (backupPath: string) => ipcRenderer.invoke('addon:scenery:restore', backupPath),
  },
  browser: {
    // Aircraft
    scanAircraft: () => ipcRenderer.invoke('addon:browser:scanAircraft'),
    toggleAircraft: (folderName: string) =>
      ipcRenderer.invoke('addon:browser:toggleAircraft', folderName),
    deleteAircraft: (folderName: string) =>
      ipcRenderer.invoke('addon:browser:deleteAircraft', folderName),
    lockAircraft: (folderName: string) =>
      ipcRenderer.invoke('addon:browser:lockAircraft', folderName),
    // Plugins
    scanPlugins: () => ipcRenderer.invoke('addon:browser:scanPlugins'),
    togglePlugin: (folderName: string) =>
      ipcRenderer.invoke('addon:browser:togglePlugin', folderName),
    deletePlugin: (folderName: string) =>
      ipcRenderer.invoke('addon:browser:deletePlugin', folderName),
    lockPlugin: (folderName: string) => ipcRenderer.invoke('addon:browser:lockPlugin', folderName),
    // Liveries
    scanLiveries: (aircraftFolder: string) =>
      ipcRenderer.invoke('addon:browser:scanLiveries', aircraftFolder),
    deleteLivery: (aircraftFolder: string, liveryFolder: string) =>
      ipcRenderer.invoke('addon:browser:deleteLivery', aircraftFolder, liveryFolder),
    // Lua Scripts
    scanLuaScripts: () => ipcRenderer.invoke('addon:browser:scanLuaScripts'),
    toggleLuaScript: (fileName: string) =>
      ipcRenderer.invoke('addon:browser:toggleLuaScript', fileName),
    deleteLuaScript: (fileName: string) =>
      ipcRenderer.invoke('addon:browser:deleteLuaScript', fileName),
    // Updates
    checkAircraftUpdates: (aircraft: import('./lib/addonManager/core/types').AircraftInfo[]) =>
      ipcRenderer.invoke('addon:browser:checkAircraftUpdates', aircraft),
    checkPluginUpdates: (plugins: import('./lib/addonManager/core/types').PluginInfo[]) =>
      ipcRenderer.invoke('addon:browser:checkPluginUpdates', plugins),
    // Icon
    getAircraftIcon: (iconPath: string) =>
      ipcRenderer.invoke('addon:browser:getAircraftIcon', iconPath),
  },
  installer: {
    browse: () => ipcRenderer.invoke('addon:installer:browse'),
    analyze: (filePaths: string[]) => ipcRenderer.invoke('addon:installer:analyze', filePaths),
    prepareInstall: (items: import('./lib/addonManager/installer/types').DetectedItem[]) =>
      ipcRenderer.invoke('addon:installer:prepareInstall', items),
    install: (tasks: import('./lib/addonManager/installer/types').InstallTask[]) =>
      ipcRenderer.invoke('addon:installer:install', tasks),
    onProgress: (
      callback: (progress: import('./lib/addonManager/installer/types').InstallProgress) => void
    ) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => {
        callback(progress as import('./lib/addonManager/installer/types').InstallProgress);
      };
      ipcRenderer.on('addon:installer:progress', handler);
      return () => {
        ipcRenderer.removeListener('addon:installer:progress', handler);
      };
    },
  },
});

declare global {
  interface XPlaneInstallation {
    id: string;
    name: string;
    path: string;
  }

  interface Window {
    appAPI: {
      isSetupComplete: () => Promise<boolean>;
      getVersion: () => Promise<string>;
      getProcessMemory: () => Promise<{ rss: number; heapUsed: number; heapTotal: number }>;
      startLoading: () => Promise<{ success: boolean; status?: DataLoadStatus; error?: string }>;
      getLoadingStatus: () => Promise<{ xplanePath: string | null; status: DataLoadStatus }>;
      clearCache: () => Promise<{ success: boolean }>;
      onLoadingProgress: (callback: (progress: LoadingProgress) => void) => () => void;
      log: {
        error: (message: string, ...args: unknown[]) => void;
        warn: (message: string, ...args: unknown[]) => void;
        info: (message: string, ...args: unknown[]) => void;
      };
      getLogPath: () => Promise<string>;
      openLogFile: () => Promise<void>;
      openLogFolder: () => Promise<void>;
      getConfigPath: () => Promise<string>;
      openConfigFolder: () => Promise<void>;
      openPath: (path: string) => Promise<void>;
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      getSendCrashReports: () => Promise<boolean>;
      setSendCrashReports: (enabled: boolean) => Promise<boolean>;
      getXPlaneVersion: () => Promise<{
        raw: string;
        major: number;
        minor: number;
        patch: number;
        channel: 'release' | 'beta' | 'ec' | 'unknown';
        channelBuild: number;
        commit: string;
        isSteam: boolean;
      } | null>;
      getTileCacheStats: () => Promise<{
        totalSize: number;
        entryCount: number;
        hitRate: number;
      }>;
      setZoomFactor: (factor: number) => void;
      getZoomFactor: () => number;
      getFilePathForDrop: (file: File) => string;
      resyncCustomAirports: () => Promise<{ synced: boolean; count: number; diff: number }>;
      onAirportsUpdated: (callback: () => void) => () => void;
      onFocusSearch: (callback: () => void) => () => void;
      onDeepLink: (callback: (data: { type: string; icao?: string }) => void) => () => void;
    };
    airportAPI: {
      getAirports: () => Promise<Airport[]>;
      getDistinctCountries: () => Promise<string[]>;
      getAirportData: (icao: string) => Promise<string>;
      fetchMetar: (icao: string) => Promise<ApiResponse>;
      fetchTaf: (icao: string) => Promise<ApiResponse>;
      fetchGatewayReleases: () => Promise<ApiResponse>;
      fetchGatewayReleasePacks: (version: string) => Promise<ApiResponse>;
      fetchGatewayAirport: (icao: string) => Promise<ApiResponse>;
      fetchGatewayScenery: (sceneryId: number) => Promise<ApiResponse>;
      fetchVatsimData: () => Promise<{ data: VatsimData | null; error: string | null }>;
      fetchVatsimMetar: (icao: string) => Promise<ApiResponse>;
      fetchVatsimEvents: () => Promise<{ data: VatsimEventsResponse | null; error: string | null }>;
      fetchIvaoData: () => Promise<{ data: IvaoData | null; error: string | null }>;
    };
    xplaneAPI: {
      getPath: () => Promise<string | null>;
      setPath: (path: string) => Promise<PathSetResult>;
      changePath: (path: string) => Promise<PathSetResult>;
      validatePath: (path: string) => Promise<PathValidation>;
      detectInstallations: () => Promise<string[]>;
      browseForPath: () => Promise<BrowseResult | null>;
      getInstallations: () => Promise<XPlaneInstallation[]>;
      getActiveInstallation: () => Promise<XPlaneInstallation | null>;
      addInstallation: (
        name: string,
        path: string
      ) => Promise<{ success: boolean; installation?: XPlaneInstallation; errors?: string[] }>;
      removeInstallation: (id: string) => Promise<boolean>;
      renameInstallation: (id: string, name: string) => Promise<boolean>;
      switchInstallation: (id: string) => Promise<boolean>;
    };
    navAPI: {
      loadDatabase: (xplanePath?: string) => Promise<NavLoadResult>;
      getStatus: () => Promise<NavDBStatus>;
      getVORsInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getNDBsInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getDMEsInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getILSInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getWaypointsInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Waypoint[]>;
      getAirspacesNearPoint: (lat: number, lon: number, radiusNm: number) => Promise<Airspace[]>;
      getAllAirspaces: () => Promise<Airspace[]>;
      getAirwaySegments: (airwayName: string) => Promise<AirwaySegmentWithCoords[]>;
      // New ILS/approach component queries
      getGlideSlopesInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getMarkersInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getILSComponentsInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getApproachAidsInRadius: (lat: number, lon: number, radiusNm: number) => Promise<Navaid[]>;
      getApproachNavaidsByAirport: (airportIcao: string) => Promise<Navaid[]>;
      getApproachNavaidsByRunway: (airportIcao: string, runway: string) => Promise<Navaid[]>;
      // Search and procedures
      searchNavaids: (query: string, limit?: number) => Promise<NavSearchResult[]>;
      getAirportProcedures: (icao: string) => Promise<AirportProcedures | null>;
      // New data queries
      getDataSources: () => Promise<NavDataSources | null>;
      getATCByFacility: (facilityId: string) => Promise<ATCController | null>;
      getAllATCControllers: () => Promise<ATCController[]>;
      getHoldingPatterns: (fixId: string) => Promise<HoldingPattern[]>;
      getAirportMetadata: (icao: string) => Promise<AirportMetadata | null>;
      getTransitionAltitude: (icao: string) => Promise<number | null>;
      // Bulk data retrieval for map layers (with coordinates resolved)
      getAllHoldingPatterns: () => Promise<
        (HoldingPattern & { latitude: number; longitude: number })[]
      >;
      // Bounds-based queries (SQLite direct - more efficient)
      getNavaidsInBounds: (
        minLat: number,
        maxLat: number,
        minLon: number,
        maxLon: number,
        types?: string[],
        limit?: number
      ) => Promise<Navaid[]>;
      getWaypointsInBounds: (
        minLat: number,
        maxLat: number,
        minLon: number,
        maxLon: number,
        limit?: number
      ) => Promise<Waypoint[]>;
      resolveWaypointCoords: (
        waypointId: string,
        region?: string,
        airportLat?: number,
        airportLon?: number
      ) => Promise<{ latitude: number; longitude: number } | null>;
      resolveNavaidCoords: (
        navaidId: string,
        region?: string,
        airportLat?: number,
        airportLon?: number
      ) => Promise<{ latitude: number; longitude: number; type: string } | null>;
    };
    launcherAPI: {
      scanAircraft: () => Promise<{ success: boolean; aircraft: Aircraft[]; error?: string }>;
      getAircraft: () => Promise<Aircraft[]>;
      getWeatherPresets: () => Promise<WeatherPreset[]>;
      launch: (payload: FlightInit) => Promise<{ success: boolean; error?: string }>;
      getAircraftImage: (imagePath: string) => Promise<string | null>;
    };
    flightPlanAPI: {
      openFile: () => Promise<{ content: string; fileName: string } | null>;
      enrich: (
        fmsData: import('./types/fms').FMSFlightPlan
      ) => Promise<import('./types/fms').EnrichedFlightPlan | null>;
    };
    simbriefAPI: {
      fetchLatest: (pilotId: string) => Promise<import('./types/simbrief').SimBriefFetchResult>;
    };
    // REST + WebSocket (REST goes through IPC to avoid CORS)
    xplaneServiceAPI: {
      isAPIAvailable: () => Promise<boolean>;
      getCapabilities: () => Promise<{
        api: { versions: string[] };
        'x-plane': { version: string };
      } | null>;
      startFlight: (payload: unknown) => Promise<{ success: boolean; error?: string }>;
      getDataref: (name: string) => Promise<number | number[] | null>;
      setDataref: (
        name: string,
        value: number | number[]
      ) => Promise<{ success: boolean; error?: string }>;
      activateCommand: (
        name: string,
        duration?: number
      ) => Promise<{ success: boolean; error?: string }>;
      startStateStream: () => Promise<XPlaneAPIResult>;
      stopStateStream: () => Promise<XPlaneAPIResult>;
      forceReconnect: () => Promise<XPlaneAPIResult>;
      isStreamConnected: () => Promise<boolean>;
      onStateUpdate: (callback: (state: PlaneState) => void) => () => void;
      onConnectionChange: (callback: (connected: boolean) => void) => () => void;
      onStateClear: (callback: () => void) => () => void;
    };
    addonManagerAPI: {
      scenery: {
        analyze: () => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').SceneryEntry[] }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        sort: () => Promise<
          | { ok: true; value: { backupPath: string } }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        saveOrder: (
          folderNames: string[]
        ) => Promise<
          | { ok: true; value: { backupPath: string } }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        toggle: (
          folderName: string
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').SceneryEntry }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        deleteScenery: (
          folderName: string
        ) => Promise<
          | { ok: true; value: { wasSymlink: boolean } }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        move: (
          folderName: string,
          direction: 'up' | 'down'
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').SceneryEntry[] }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        backup: () => Promise<
          | { ok: true; value: string }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
        listBackups: () => Promise<{ path: string; timestamp: string }[]>;
        restore: (
          backupPath: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('./lib/addonManager/core/types').SceneryError }
        >;
      };
      browser: {
        scanAircraft: () => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').AircraftInfo[] }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        toggleAircraft: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        deleteAircraft: (
          folderName: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        lockAircraft: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        scanPlugins: () => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').PluginInfo[] }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        togglePlugin: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        deletePlugin: (
          folderName: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        lockPlugin: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        scanLiveries: (
          aircraftFolder: string
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').LiveryInfo[] }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        deleteLivery: (
          aircraftFolder: string,
          liveryFolder: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        scanLuaScripts: () => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').LuaScriptInfo[] }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        toggleLuaScript: (
          fileName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        deleteLuaScript: (
          fileName: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        checkAircraftUpdates: (
          aircraft: import('./lib/addonManager/core/types').AircraftInfo[]
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').AircraftInfo[] }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        checkPluginUpdates: (
          plugins: import('./lib/addonManager/core/types').PluginInfo[]
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/core/types').PluginInfo[] }
          | { ok: false; error: import('./lib/addonManager/core/types').BrowserError }
        >;
        getAircraftIcon: (iconPath: string) => Promise<string | null>;
      };
      installer: {
        browse: () => Promise<
          { ok: true; value: string[] } | { ok: false; error: { code: string; reason: string } }
        >;
        analyze: (
          filePaths: string[]
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/installer/types').DetectedItem[] }
          | { ok: false; error: import('./lib/addonManager/installer/types').InstallerError }
        >;
        prepareInstall: (
          items: import('./lib/addonManager/installer/types').DetectedItem[]
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/installer/types').InstallTask[] }
          | { ok: false; error: import('./lib/addonManager/installer/types').InstallerError }
        >;
        install: (
          tasks: import('./lib/addonManager/installer/types').InstallTask[]
        ) => Promise<
          | { ok: true; value: import('./lib/addonManager/installer/types').InstallResult[] }
          | { ok: false; error: import('./lib/addonManager/installer/types').InstallerError }
        >;
        onProgress: (
          callback: (progress: import('./lib/addonManager/installer/types').InstallProgress) => void
        ) => () => void;
      };
    };
  }
}
