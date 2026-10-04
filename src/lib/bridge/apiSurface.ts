/**
 * The window.*API surface shared by the Electron preload and the browser bridge.
 *
 * Both build the same objects from a transport; the channel names live only here,
 * so the desktop and a tablet cannot drift apart.
 */
import type { AutoRouteRequest, PlanDraft } from '@/lib/flightplan/builder/types';
import type { RemoteAccessStatus } from '@/lib/remote/types';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type {
  XPLogReadResult,
  openXPlaneLogExternally as openXPlaneLogExternallyFn,
} from '@/lib/xplaneServices/log/ipc';
// Import types from canonical sources
import type { AircraftHint, FlightRecorderEvent } from '@/types/flightRecorder';
import type { TrafficSnapshot } from '@/types/traffic';
import type { UpdateStatus } from '@/types/update';
import type { LoadingProgress, PlaneState } from '@/types/xplane';

type XPLogOpenResult = Awaited<ReturnType<typeof openXPlaneLogExternallyFn>>;

export interface BridgeTransport {
  invoke: (channel: string, ...args: unknown[]) => Promise<any>;
  send: (channel: string, ...args: unknown[]) => void;
  /** Subscribe to a push from main. Returns the unsubscribe function. */
  on: <T>(channel: string, listener: (payload: T) => void) => () => void;
}

/** Members that are not IPC: supplied by the preload or by the browser bridge. */
export interface BridgeExtras {
  platform: NodeJS.Platform;
  isRemoteClient: boolean;
  setZoomFactor: (factor: number) => void;
  getZoomFactor: () => number;
  getFilePathForDrop: (file: File) => string;
  versions: { node: () => string; chrome: () => string; electron: () => string };
}

export type BridgeApis = Pick<
  Window,
  | 'airportAPI'
  | 'vatsimSectorAPI'
  | 'versions'
  | 'appAPI'
  | 'xplaneAPI'
  | 'navAPI'
  | 'launcherAPI'
  | 'flightPlanAPI'
  | 'simbriefAPI'
  | 'xplaneServiceAPI'
  | 'addonManagerAPI'
  | 'debugAPI'
  | 'analyticsAPI'
  | 'companionAppsAPI'
  | 'flightsAPI'
  | 'xpLogAPI'
  | 'remoteAccessAPI'
>;

export function buildBridgeApis(t: BridgeTransport, x: BridgeExtras): BridgeApis {
  return {
    versions: x.versions,
    airportAPI: {
      getAirports: () => t.invoke('get-airports'),
      getDistinctCountries: () => t.invoke('data:getDistinctCountries'),
      getAirportData: (icao: string) => t.invoke('get-airport-data', icao),
      fetchMetar: (icao: string) => t.invoke('fetch-metar', icao),
      fetchTaf: (icao: string) => t.invoke('fetch-taf', icao),
      fetchGatewayReleases: () => t.invoke('fetch-gateway-releases'),
      fetchGatewayReleasePacks: (version: string) =>
        t.invoke('fetch-gateway-release-packs', version),
      fetchGatewayAirport: (icao: string) => t.invoke('fetch-gateway-airport', icao),
      fetchGatewayScenery: (sceneryId: number) => t.invoke('fetch-gateway-scenery', sceneryId),
      fetchVatsimData: () => t.invoke('fetch-vatsim-data'),
      fetchVatsimMetar: (icao: string) => t.invoke('fetch-vatsim-metar', icao),
      fetchVatsimMetarsAll: () => t.invoke('fetch-vatsim-metars-all'),
      fetchVatsimEvents: () => t.invoke('fetch-vatsim-events'),
      fetchIvaoData: () => t.invoke('fetch-ivao-data'),
    },

    vatsimSectorAPI: {
      getData: () => t.invoke('vatsim-sectors:getData'),
      getStatus: () => t.invoke('vatsim-sectors:getStatus'),
      refresh: () => t.invoke('vatsim-sectors:refresh'),
      clearCache: () => t.invoke('vatsim-sectors:clearCache'),
      onUpdated: (callback: () => void) => t.on('vatsim-sectors:updated', callback),
    },

    appAPI: {
      platform: x.platform,
      isRemoteClient: x.isRemoteClient,
      isSetupComplete: () => t.invoke('app:isSetupComplete'),
      getVersion: () => t.invoke('app:getVersion'),
      getThirdPartyNotices: () => t.invoke('app:getThirdPartyNotices'),
      getUpdateStatus: () => t.invoke('app:getUpdateStatus'),
      checkForUpdates: () => t.invoke('app:checkForUpdates'),
      installUpdate: () => t.invoke('app:installUpdate'),
      openFlightStripWindow: () => t.invoke('app:openFlightStripWindow'),
      isFlightStripWindowOpen: () => t.invoke('app:isFlightStripWindowOpen'),
      onFlightStripWindowOpen: (callback: (open: boolean) => void) =>
        t.on('app:flightStripWindowOpen', callback),
      onUpdateStatus: (callback: (status: UpdateStatus) => void) =>
        t.on('app:updateStatus', callback),
      getCliFlags: () => t.invoke('app:getCliFlags'),
      getProcessMemory: () =>
        t.invoke('app:getProcessMemory') as Promise<{
          rss: number;
          heapUsed: number;
          heapTotal: number;
        }>,
      startLoading: () => t.invoke('app:startLoading'),
      getLoadingStatus: () => t.invoke('app:getLoadingStatus'),
      clearCache: () => t.invoke('app:clearCache'),
      onLoadingProgress: (callback: (progress: LoadingProgress) => void) =>
        t.on('loading-progress', callback),
      log: {
        error: (message: string, ...args: unknown[]) => t.send('log:error', message, args),
        warn: (message: string, ...args: unknown[]) => t.send('log:warn', message, args),
        info: (message: string, ...args: unknown[]) => t.send('log:info', message, args),
      },
      getLogPath: () => t.invoke('app:getLogPath'),
      openLogFile: () => t.invoke('app:openLogFile'),
      openLogFolder: () => t.invoke('app:openLogFolder'),
      getConfigPath: () => t.invoke('app:getConfigPath'),
      openConfigFolder: () => t.invoke('app:openConfigFolder'),
      openPath: (path: string) => t.invoke('app:openPath', path),
      clipboardWrite: (text: string) => t.invoke('app:clipboardWrite', text),
      clipboardWriteImage: (dataUrl: string) => t.invoke('app:clipboardWriteImage', dataUrl),
      openExternal: (url: string) => t.invoke('app:openExternal', url),
      getSendCrashReports: () => t.invoke('app:getSendCrashReports'),
      setSendCrashReports: (enabled: boolean) => t.invoke('app:setSendCrashReports', enabled),
      getXPlaneVersion: () => t.invoke('app:getXPlaneVersion'),
      getTileCacheStats: () => t.invoke('app:getTileCacheStats'),
      setZoomFactor: x.setZoomFactor,
      getZoomFactor: x.getZoomFactor,
      getFilePathForDrop: x.getFilePathForDrop,
      onFocusSearch: (callback: () => void) => t.on('focus-search', callback),
      resyncCustomAirports: () =>
        t.invoke('airport:resync-custom') as Promise<{
          synced: boolean;
          count: number;
          diff: number;
        }>,
      onAirportsUpdated: (callback: () => void) => t.on('airports-updated', callback),
      onDeepLink: (callback: (data: { type: string; icao?: string }) => void) =>
        t.on('deep-link', callback),
      pickDirectory: (opts?: { title?: string; defaultPath?: string }) =>
        t.invoke('app:pickDirectory', opts),
    },

    xplaneAPI: {
      getPath: () => t.invoke('xplane:getPath'),
      setPath: (path: string) => t.invoke('xplane:setPath', path),
      changePath: (path: string) => t.invoke('xplane:changePath', path),
      validatePath: (path: string) => t.invoke('xplane:validatePath', path),
      detectInstallations: () => t.invoke('xplane:detectInstallations'),
      browseForPath: () => t.invoke('xplane:browseForPath'),
      // Multi-installation management
      getInstallations: () => t.invoke('xplane:getInstallations'),
      getActiveInstallation: () => t.invoke('xplane:getActiveInstallation'),
      addInstallation: (name: string, path: string) =>
        t.invoke('xplane:addInstallation', name, path),
      removeInstallation: (id: string) => t.invoke('xplane:removeInstallation', id),
      renameInstallation: (id: string, name: string) =>
        t.invoke('xplane:renameInstallation', id, name),
      switchInstallation: (id: string) => t.invoke('xplane:switchInstallation', id),
      writeTaxiRoute: (json: string) => t.invoke('taxi:writeRoute', json),
    },

    navAPI: {
      loadDatabase: (xplanePath?: string) => t.invoke('nav:loadDatabase', xplanePath),
      getStatus: () => t.invoke('nav:getStatus'),
      getVORsInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getVORsInRadius', lat, lon, radiusNm),
      getNDBsInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getNDBsInRadius', lat, lon, radiusNm),
      getDMEsInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getDMEsInRadius', lat, lon, radiusNm),
      getILSInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getILSInRadius', lat, lon, radiusNm),
      getWaypointsInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getWaypointsInRadius', lat, lon, radiusNm),
      getAirspacesNearPoint: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getAirspacesNearPoint', lat, lon, radiusNm),
      getAllAirspaces: () => t.invoke('nav:getAllAirspaces'),
      getAirwaySegments: (airwayName: string) => t.invoke('nav:getAirwaySegments', airwayName),
      getGlideSlopesInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getGlideSlopesInRadius', lat, lon, radiusNm),
      getMarkersInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getMarkersInRadius', lat, lon, radiusNm),
      getILSComponentsInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getILSComponentsInRadius', lat, lon, radiusNm),
      getApproachAidsInRadius: (lat: number, lon: number, radiusNm: number) =>
        t.invoke('nav:getApproachAidsInRadius', lat, lon, radiusNm),
      getApproachNavaidsByAirport: (airportIcao: string) =>
        t.invoke('nav:getApproachNavaidsByAirport', airportIcao),
      getApproachNavaidsByRunway: (airportIcao: string, runway: string) =>
        t.invoke('nav:getApproachNavaidsByRunway', airportIcao, runway),
      searchNavaids: (query: string, limit?: number) => t.invoke('nav:searchNavaids', query, limit),
      getAirportProcedures: (icao: string) => t.invoke('nav:getAirportProcedures', icao),
      // New API methods
      getDataSources: () => t.invoke('nav:getDataSources'),
      getATCByFacility: (facilityId: string) => t.invoke('nav:getATCByFacility', facilityId),
      getAllATCControllers: () => t.invoke('nav:getAllATCControllers'),
      getHoldingPatterns: (fixId: string) => t.invoke('nav:getHoldingPatterns', fixId),
      getAirportMetadata: (icao: string) => t.invoke('nav:getAirportMetadata', icao),
      getTransitionAltitude: (icao: string) => t.invoke('nav:getTransitionAltitude', icao),
      // Bulk data retrieval for map layers
      getAllHoldingPatterns: () => t.invoke('nav:getAllHoldingPatterns'),
      // Bounds-based queries (SQLite direct - more efficient)
      getNavaidsInBounds: (
        minLat: number,
        maxLat: number,
        minLon: number,
        maxLon: number,
        types?: string[],
        limit?: number
      ) => t.invoke('nav:getNavaidsInBounds', minLat, maxLat, minLon, maxLon, types, limit),
      getWaypointsInBounds: (
        minLat: number,
        maxLat: number,
        minLon: number,
        maxLon: number,
        limit?: number
      ) => t.invoke('nav:getWaypointsInBounds', minLat, maxLat, minLon, maxLon, limit),
      resolveWaypointCoords: (
        waypointId: string,
        region?: string,
        airportLat?: number,
        airportLon?: number
      ) => t.invoke('nav:resolveWaypointCoords', waypointId, region, airportLat, airportLon),
      resolveNavaidCoords: (
        navaidId: string,
        region?: string,
        airportLat?: number,
        airportLon?: number
      ) => t.invoke('nav:resolveNavaidCoords', navaidId, region, airportLat, airportLon),
    },

    launcherAPI: {
      scanAircraft: () => t.invoke('launcher:scanAircraft'),
      getAircraft: () => t.invoke('launcher:getAircraft'),
      getWeatherPresets: () => t.invoke('launcher:getWeatherPresets'),
      launch: (payload: FlightInit, extraArgs?: string[]) =>
        t.invoke('launcher:launch', payload, extraArgs),
      getAircraftImage: (imagePath: string) => t.invoke('launcher:getAircraftImage', imagePath),
    },

    flightPlanAPI: {
      openFile: () => t.invoke('flightplan:openFile'),
      enrich: (fmsData: import('@/types/fms').FMSFlightPlan) =>
        t.invoke('flightplan:enrich', fmsData),
      resolveRoute: (draft: PlanDraft) => t.invoke('flightplan:resolveRoute', draft),
      autoRoute: (request: AutoRouteRequest) => t.invoke('flightplan:autoRoute', request),
      saveFms: (args: { stem: string; content: string }) => t.invoke('flightplan:saveFms', args),
    },

    simbriefAPI: {
      fetchLatest: (pilotId: string) => t.invoke('simbrief:fetchLatest', pilotId),
      downloadFmsFile: (args: { url: string; targetDir: string; filename: string }) =>
        t.invoke('simbrief:downloadFmsFile', args),
    },

    // X-Plane Service API - REST + WebSocket
    // REST goes through IPC to main process to avoid CORS issues with localhost
    xplaneServiceAPI: {
      // REST API (via main process)
      isAPIAvailable: () => t.invoke('xplaneService:isAPIAvailable'),
      getCapabilities: () => t.invoke('xplaneService:getCapabilities'),
      startFlight: (payload: unknown) => t.invoke('xplaneService:startFlight', payload),
      getDataref: (name: string) => t.invoke('xplaneService:getDataref', name),
      setDataref: (name: string, value: number | number[]) =>
        t.invoke('xplaneService:setDataref', name, value),
      activateCommand: (name: string, duration?: number) =>
        t.invoke('xplaneService:activateCommand', name, duration ?? 0),
      // WebSocket streaming
      startStateStream: () => t.invoke('xplaneService:startStateStream'),
      stopStateStream: () => t.invoke('xplaneService:stopStateStream'),
      forceReconnect: () => t.invoke('xplaneService:forceReconnect'),
      isStreamConnected: () => t.invoke('xplaneService:isStreamConnected'),
      onStateUpdate: (callback: (state: PlaneState) => void) =>
        t.on('xplaneService:stateUpdate', callback),
      onConnectionChange: (callback: (connected: boolean) => void) =>
        t.on('xplaneService:connectionChange', callback),
      onStateClear: (callback: () => void) => t.on('xplaneService:stateClear', callback),
      setTrafficEnabled: (enabled: boolean) => t.invoke('xplaneService:setTrafficEnabled', enabled),
      onTrafficUpdate: (callback: (snapshot: TrafficSnapshot) => void) =>
        t.on('xplaneService:trafficUpdate', callback),
    },

    // Addon Manager API
    addonManagerAPI: {
      scenery: {
        analyze: () => t.invoke('addon:scenery:analyze'),
        sort: () => t.invoke('addon:scenery:sort'),
        saveOrder: (folderNames: string[]) => t.invoke('addon:scenery:saveOrder', folderNames),
        toggle: (folderName: string) => t.invoke('addon:scenery:toggle', folderName),
        deleteScenery: (folderName: string) => t.invoke('addon:scenery:delete', folderName),
        move: (folderName: string, direction: 'up' | 'down') =>
          t.invoke('addon:scenery:move', folderName, direction),
        backup: () => t.invoke('addon:scenery:backup'),
        listBackups: () => t.invoke('addon:scenery:listBackups'),
        restore: (backupPath: string) => t.invoke('addon:scenery:restore', backupPath),
      },
      browser: {
        // Aircraft
        scanAircraft: () => t.invoke('addon:browser:scanAircraft'),
        toggleAircraft: (folderName: string) =>
          t.invoke('addon:browser:toggleAircraft', folderName),
        deleteAircraft: (folderName: string) =>
          t.invoke('addon:browser:deleteAircraft', folderName),
        lockAircraft: (folderName: string) => t.invoke('addon:browser:lockAircraft', folderName),
        // Plugins
        scanPlugins: () => t.invoke('addon:browser:scanPlugins'),
        togglePlugin: (folderName: string) => t.invoke('addon:browser:togglePlugin', folderName),
        deletePlugin: (folderName: string) => t.invoke('addon:browser:deletePlugin', folderName),
        lockPlugin: (folderName: string) => t.invoke('addon:browser:lockPlugin', folderName),
        // Liveries
        scanLiveries: (aircraftFolder: string) =>
          t.invoke('addon:browser:scanLiveries', aircraftFolder),
        deleteLivery: (aircraftFolder: string, liveryFolder: string) =>
          t.invoke('addon:browser:deleteLivery', aircraftFolder, liveryFolder),
        // Lua Scripts
        scanLuaScripts: () => t.invoke('addon:browser:scanLuaScripts'),
        toggleLuaScript: (fileName: string) => t.invoke('addon:browser:toggleLuaScript', fileName),
        deleteLuaScript: (fileName: string) => t.invoke('addon:browser:deleteLuaScript', fileName),
        // Updates
        checkAircraftUpdates: (aircraft: import('@/lib/addonManager/core/types').AircraftInfo[]) =>
          t.invoke('addon:browser:checkAircraftUpdates', aircraft),
        checkPluginUpdates: (plugins: import('@/lib/addonManager/core/types').PluginInfo[]) =>
          t.invoke('addon:browser:checkPluginUpdates', plugins),
        // Icon
        getAircraftIcon: (iconPath: string) => t.invoke('addon:browser:getAircraftIcon', iconPath),
      },
      installer: {
        browse: () => t.invoke('addon:installer:browse'),
        analyze: (filePaths: string[]) => t.invoke('addon:installer:analyze', filePaths),
        prepareInstall: (items: import('@/lib/addonManager/installer/types').DetectedItem[]) =>
          t.invoke('addon:installer:prepareInstall', items),
        install: (tasks: import('@/lib/addonManager/installer/types').InstallTask[]) =>
          t.invoke('addon:installer:install', tasks),
        onProgress: (
          callback: (progress: import('@/lib/addonManager/installer/types').InstallProgress) => void
        ) => t.on('addon:installer:progress', callback),
      },
    },

    debugAPI: {
      dbTables: () => t.invoke('debug:dbTables'),
      dbQuery: (table: string, limit: number, offset: number) =>
        t.invoke('debug:dbQuery', table, limit, offset),
      dbExec: (sql: string) => t.invoke('debug:dbExec', sql),
    },

    analyticsAPI: {
      getConsent: () => t.invoke('analytics:getConsent'),
      setConsent: (granted: boolean) => t.invoke('analytics:setConsent', granted),
      track: (event: string, properties?: Record<string, unknown>) =>
        t.send('analytics:track', event, properties),
    },

    companionAppsAPI: {
      launch: (input: { exePath: string; args?: string; cwd?: string }) =>
        t.invoke('companion-apps:launch', input),
      browseForExe: (currentExePath?: string): Promise<string | null> =>
        t.invoke('companion-apps:browseForExe', currentExePath),
      isElevated: (): Promise<boolean> => t.invoke('companion-apps:isElevated'),
    },

    flightsAPI: {
      list: () => t.invoke('flights:list'),
      get: (id: string) => t.invoke('flights:get', id),
      delete: (id: string) => t.invoke('flights:delete', id),
      clear: () => t.invoke('flights:clear'),
      liveState: () => t.invoke('flights:liveState'),
      setAircraftHint: (hint: AircraftHint | null) => t.invoke('flights:setAircraftHint', hint),
      setEnabled: (enabled: boolean) => t.invoke('flights:setEnabled', enabled),
      openFolder: () => t.invoke('flights:openFolder'),
      onEvent: (callback: (event: FlightRecorderEvent) => void) => t.on('flights:event', callback),
    },

    xpLogAPI: {
      read: (): Promise<XPLogReadResult> => t.invoke('xp-log:read'),
      openExternal: (): Promise<XPLogOpenResult> => t.invoke('xp-log:openExternal'),
    },
    remoteAccessAPI: {
      getStatus: () => t.invoke('remote:getStatus'),
      setEnabled: (enabled: boolean) => t.invoke('remote:setEnabled', enabled),
      resetToken: () => t.invoke('remote:resetToken'),
      setPort: (port: number) => t.invoke('remote:setPort', port),
      disconnectAll: () => t.invoke('remote:disconnectAll'),
      onStatusChanged: (callback: (status: RemoteAccessStatus) => void) =>
        t.on('remote:statusChanged', callback),
    },
  } as BridgeApis;
}

export interface BridgeChannels {
  invoke: string[];
  send: string[];
  push: string[];
}

/** Every channel the surface uses, found by building it with a recording transport. */
export function collectChannels(): BridgeChannels {
  const invoke = new Set<string>();
  const send = new Set<string>();
  const push = new Set<string>();
  const apis = buildBridgeApis(
    {
      invoke: async (channel) => void invoke.add(channel),
      send: (channel) => void send.add(channel),
      on: (channel) => {
        push.add(channel);
        return () => undefined;
      },
    },
    {
      platform: 'linux',
      isRemoteClient: false,
      setZoomFactor: () => undefined,
      getZoomFactor: () => 1,
      getFilePathForDrop: () => '',
      versions: { node: () => '', chrome: () => '', electron: () => '' },
    }
  );
  const walk = (value: unknown) => {
    if (typeof value === 'function') {
      (value as (...args: unknown[]) => unknown)();
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  Object.entries(apis)
    .filter(([key]) => key !== 'versions')
    .forEach(([, api]) => walk(api));
  return { invoke: [...invoke], send: [...send], push: [...push] };
}
