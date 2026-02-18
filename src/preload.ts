import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import type { AirportProcedures, Procedure, ProcedureWaypoint } from './lib/parsers/nav/cifpParser';
import type {
  Airport,
  AirportSourceBreakdown,
  DataLoadStatus,
} from './lib/xplaneServices/dataService/XPlaneDataManager';
import type {
  DataSourceInfo,
  DataSourceType,
  NavDataSources,
} from './lib/xplaneServices/dataService/cycleInfo';
// Import types from canonical sources
import type { Aircraft, LaunchConfig, WeatherPreset } from './types/aircraft';
import type {
  ApiResponse,
  BrowseResult,
  NavDBStatus,
  NavLoadResult,
  NavSearchResult,
  PathSetResult,
  PathValidation,
} from './types/ipc';
import type {
  ATCController,
  ATCRole,
  AirportMetadata,
  Airspace,
  HoldingPattern,
  Navaid,
  Waypoint,
} from './types/navigation';
import type { AirwaySegmentWithCoords } from './types/navigation';
import type {
  VatsimATIS,
  VatsimController,
  VatsimData,
  VatsimEvent,
  VatsimEventsResponse,
  VatsimPilot,
  VatsimPrefile,
} from './types/vatsim';
import type { LoadingProgress, PlaneState, XPlaneAPIResult } from './types/xplane';

contextBridge.exposeInMainWorld('airportAPI', {
  getAirports: () => ipcRenderer.invoke('get-airports'),
  getAirportData: (icao: string) => ipcRenderer.invoke('get-airport-data', icao),
  fetchMetar: (icao: string) => ipcRenderer.invoke('fetch-metar', icao),
  fetchTaf: (icao: string) => ipcRenderer.invoke('fetch-taf', icao),
  fetchGatewayAirport: (icao: string) => ipcRenderer.invoke('fetch-gateway-airport', icao),
  fetchGatewayScenery: (sceneryId: number) =>
    ipcRenderer.invoke('fetch-gateway-scenery', sceneryId),
  fetchVatsimData: () => ipcRenderer.invoke('fetch-vatsim-data'),
  fetchVatsimMetar: (icao: string) => ipcRenderer.invoke('fetch-vatsim-metar', icao),
  fetchVatsimEvents: () => ipcRenderer.invoke('fetch-vatsim-events'),
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
  startLoading: () => ipcRenderer.invoke('app:startLoading'),
  getLoadingStatus: () => ipcRenderer.invoke('app:getLoadingStatus'),
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
});

contextBridge.exposeInMainWorld('xplaneAPI', {
  getPath: () => ipcRenderer.invoke('xplane:getPath'),
  setPath: (path: string) => ipcRenderer.invoke('xplane:setPath', path),
  changePath: (path: string) => ipcRenderer.invoke('xplane:changePath', path),
  validatePath: (path: string) => ipcRenderer.invoke('xplane:validatePath', path),
  detectInstallations: () => ipcRenderer.invoke('xplane:detectInstallations'),
  browseForPath: () => ipcRenderer.invoke('xplane:browseForPath'),
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
  getAirwaysInRadius: (lat: number, lon: number, radiusNm: number) =>
    ipcRenderer.invoke('nav:getAirwaysInRadius', lat, lon, radiusNm),
  getAllAirwaysWithCoords: () => ipcRenderer.invoke('nav:getAllAirwaysWithCoords'),
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
});

contextBridge.exposeInMainWorld('launcherAPI', {
  scanAircraft: () => ipcRenderer.invoke('launcher:scanAircraft'),
  getAircraft: () => ipcRenderer.invoke('launcher:getAircraft'),
  getWeatherPresets: () => ipcRenderer.invoke('launcher:getWeatherPresets'),
  launch: (config: LaunchConfig) => ipcRenderer.invoke('launcher:launch', config),
  getAircraftImage: (imagePath: string) =>
    ipcRenderer.invoke('launcher:getAircraftImage', imagePath),
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
});

declare global {
  interface Window {
    appAPI: {
      isSetupComplete: () => Promise<boolean>;
      getVersion: () => Promise<string>;
      startLoading: () => Promise<{ success: boolean; status?: DataLoadStatus; error?: string }>;
      getLoadingStatus: () => Promise<{ xplanePath: string | null; status: DataLoadStatus }>;
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
    };
    airportAPI: {
      getAirports: () => Promise<Airport[]>;
      getAirportData: (icao: string) => Promise<string>;
      fetchMetar: (icao: string) => Promise<ApiResponse>;
      fetchTaf: (icao: string) => Promise<ApiResponse>;
      fetchGatewayAirport: (icao: string) => Promise<ApiResponse>;
      fetchGatewayScenery: (sceneryId: number) => Promise<ApiResponse>;
      fetchVatsimData: () => Promise<{ data: VatsimData | null; error: string | null }>;
      fetchVatsimMetar: (icao: string) => Promise<ApiResponse>;
      fetchVatsimEvents: () => Promise<{ data: VatsimEventsResponse | null; error: string | null }>;
    };
    xplaneAPI: {
      getPath: () => Promise<string | null>;
      setPath: (path: string) => Promise<PathSetResult>;
      changePath: (path: string) => Promise<PathSetResult>;
      validatePath: (path: string) => Promise<PathValidation>;
      detectInstallations: () => Promise<string[]>;
      browseForPath: () => Promise<BrowseResult | null>;
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
      getAirwaysInRadius: (
        lat: number,
        lon: number,
        radiusNm: number
      ) => Promise<AirwaySegmentWithCoords[]>;
      getAllAirwaysWithCoords: () => Promise<AirwaySegmentWithCoords[]>;
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
    };
    launcherAPI: {
      scanAircraft: () => Promise<{ success: boolean; aircraft: Aircraft[]; error?: string }>;
      getAircraft: () => Promise<Aircraft[]>;
      getWeatherPresets: () => Promise<WeatherPreset[]>;
      launch: (config: LaunchConfig) => Promise<{ success: boolean; error?: string }>;
      getAircraftImage: (imagePath: string) => Promise<string | null>;
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
      isStreamConnected: () => Promise<boolean>;
      onStateUpdate: (callback: (state: PlaneState) => void) => () => void;
      onConnectionChange: (callback: (connected: boolean) => void) => () => void;
    };
  }
}
