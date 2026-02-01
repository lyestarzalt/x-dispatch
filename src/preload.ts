import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

interface LoadingProgress {
  step: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  message: string;
  count?: number;
  error?: string;
}

interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  fileOffset: number;
  dataLength: number;
  type: 'land' | 'seaplane' | 'heliport';
}

contextBridge.exposeInMainWorld('airportAPI', {
  getAirports: () => ipcRenderer.invoke('get-airports'),
  getAirportData: (icao: string) => ipcRenderer.invoke('get-airport-data', icao),
  fetchMetar: (icao: string) => ipcRenderer.invoke('fetch-metar', icao),
  fetchTaf: (icao: string) => ipcRenderer.invoke('fetch-taf', icao),
  fetchGatewayAirport: (icao: string) => ipcRenderer.invoke('fetch-gateway-airport', icao),
  fetchGatewayScenery: (sceneryId: number) =>
    ipcRenderer.invoke('fetch-gateway-scenery', sceneryId),
  fetchVatsimData: () => ipcRenderer.invoke('fetch-vatsim-data'),
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
});

contextBridge.exposeInMainWorld('xplaneAPI', {
  getPath: () => ipcRenderer.invoke('xplane:getPath'),
  setPath: (path: string) => ipcRenderer.invoke('xplane:setPath', path),
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
});

contextBridge.exposeInMainWorld('launcherAPI', {
  scanAircraft: () => ipcRenderer.invoke('launcher:scanAircraft'),
  getAircraft: () => ipcRenderer.invoke('launcher:getAircraft'),
  getWeatherPresets: () => ipcRenderer.invoke('launcher:getWeatherPresets'),
  launch: (config: LaunchConfig) => ipcRenderer.invoke('launcher:launch', config),
  getAircraftImage: (imagePath: string) =>
    ipcRenderer.invoke('launcher:getAircraftImage', imagePath),
});

interface LaunchConfig {
  aircraft: Aircraft;
  livery: string;
  fuel: { percentage: number; tankWeights: number[] };
  startPosition: { type: 'runway' | 'ramp'; airport: string; position: string };
  time: { dayOfYear: number; timeInHours: number; latitude: number; longitude: number };
  weather: { name: string; definition: string };
}

interface Aircraft {
  path: string;
  name: string;
  manufacturer: string;
  studio: string;
  author: string;
  tailNumber: string;
  emptyWeight: number;
  maxWeight: number;
  maxFuel: number;
  tankNames: string[];
  previewImage: string | null;
  thumbnailImage: string | null;
  liveries: { name: string; displayName: string; previewImage: string | null }[];
}

interface WeatherPreset {
  name: string;
  definition: string;
}

interface ApiResponse {
  data: string | null;
  error: string | null;
}

// VATSIM data types
interface VatsimPilot {
  cid: number;
  name: string;
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  transponder: string;
  heading: number;
  flight_plan: {
    departure: string;
    arrival: string;
    aircraft_short: string;
    aircraft_faa: string;
    route: string;
  } | null;
}

interface VatsimData {
  general: {
    version: number;
    update_timestamp: string;
    connected_clients: number;
  };
  pilots: VatsimPilot[];
  controllers: unknown[];
  atis: unknown[];
}

// Navigation data types (mirrored from navParser/types.ts for renderer process)
interface Navaid {
  type:
    | 'VOR'
    | 'VORTAC'
    | 'VOR-DME'
    | 'NDB'
    | 'DME'
    | 'TACAN'
    | 'ILS'
    | 'LOC'
    | 'GS'
    | 'OM'
    | 'MM'
    | 'IM'
    | 'FPAP'
    | 'GLS'
    | 'LTP'
    | 'FTP';
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  frequency: number;
  range: number;
  magneticVariation: number;
  region: string;
  country: string;
  // Extended fields for approach aids
  bearing?: number;
  associatedAirport?: string;
  associatedRunway?: string;
  glidepathAngle?: number;
  course?: number;
  lengthOffset?: number;
  thresholdCrossingHeight?: number;
  refPathIdentifier?: string;
  approachPerformance?: 'LP' | 'LPV' | 'APV-II' | 'GLS';
}

interface Waypoint {
  id: string;
  latitude: number;
  longitude: number;
  region: string;
  areaCode: string;
  description: string;
}

interface Airspace {
  class: string;
  name: string;
  upperLimit: string;
  lowerLimit: string;
  coordinates: [number, number][];
}

interface AirwaySegmentWithCoords {
  name: string;
  fromFix: string;
  toFix: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  isHigh: boolean;
  baseFl: number;
  topFl: number;
}

interface NavDBStatus {
  status: {
    navaids: boolean;
    waypoints: boolean;
    airspaces: boolean;
    airways: boolean;
  };
  counts: {
    navaids: number;
    waypoints: number;
    airspaces: number;
    airways: number;
  };
}

interface NavLoadResult {
  success: boolean;
  counts?: { navaids: number; waypoints: number; airspaces: number; airways: number };
  error?: string;
}

interface NavSearchResult {
  type: 'VOR' | 'NDB' | 'DME' | 'ILS' | 'WAYPOINT';
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  frequency?: number;
}

interface ProcedureWaypoint {
  fixId: string;
  fixRegion: string;
  fixType: string;
  pathTerminator: string;
  course: number | null;
  distance: number | null;
  altitude: { descriptor: string; altitude1: number | null; altitude2: number | null } | null;
  speed: number | null;
  turnDirection: 'L' | 'R' | null;
}

interface Procedure {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  runway: string | null;
  transition: string | null;
  waypoints: ProcedureWaypoint[];
}

interface AirportProcedures {
  icao: string;
  sids: Procedure[];
  stars: Procedure[];
  approaches: Procedure[];
}

// X-Plane path validation result
interface PathValidation {
  valid: boolean;
  errors: string[];
}

// X-Plane path set result
interface PathSetResult {
  success: boolean;
  errors: string[];
}

// Browse result
interface BrowseResult {
  path: string;
  valid: boolean;
  errors: string[];
}

// Data load status
interface DataLoadStatus {
  xplanePath: string | null;
  pathValid: boolean;
  airports: { loaded: boolean; count: number; source: string | null };
  navaids: {
    loaded: boolean;
    count: number;
    byType: Record<string, number>;
    source: string | null;
  };
  waypoints: { loaded: boolean; count: number; source: string | null };
  airspaces: { loaded: boolean; count: number; source: string | null };
  airways: { loaded: boolean; count: number; source: string | null };
}

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
    };
    airportAPI: {
      getAirports: () => Promise<Airport[]>;
      getAirportData: (icao: string) => Promise<string>;
      fetchMetar: (icao: string) => Promise<ApiResponse>;
      fetchTaf: (icao: string) => Promise<ApiResponse>;
      fetchGatewayAirport: (icao: string) => Promise<ApiResponse>;
      fetchGatewayScenery: (sceneryId: number) => Promise<ApiResponse>;
      fetchVatsimData: () => Promise<{ data: VatsimData | null; error: string | null }>;
    };
    xplaneAPI: {
      getPath: () => Promise<string | null>;
      setPath: (path: string) => Promise<PathSetResult>;
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
    };
    launcherAPI: {
      scanAircraft: () => Promise<{ success: boolean; aircraft: Aircraft[]; error?: string }>;
      getAircraft: () => Promise<Aircraft[]>;
      getWeatherPresets: () => Promise<WeatherPreset[]>;
      launch: (config: LaunchConfig) => Promise<{ success: boolean; error?: string }>;
      getAircraftImage: (imagePath: string) => Promise<string | null>;
    };
  }
}
