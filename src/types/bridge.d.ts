/**
 * Types of the window.*API surface. The objects are built in
 * `src/lib/bridge/apiSurface.ts`; keep both in step.
 */
import type {
  AnalyticsConsentState,
  AnalyticsEventName,
  AnalyticsEventProps,
} from '@/lib/analytics/events';
import type {
  AutoRouteRequest,
  AutoRouteResult,
  NatFeed,
  PlanDraft,
  RouteResolveResult,
  SaveFmsResult,
} from '@/lib/flightplan/builder/types';
import type { AppAction } from '@/lib/nativeShell/appUrl';
import type { RemoteAccessStatus } from '@/lib/remote/types';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Airport, DataLoadStatus } from '@/lib/xplaneServices/dataService/XPlaneDataManager';
import type { NavDataSources } from '@/lib/xplaneServices/dataService/cycleInfo';
import type {
  XPLogReadResult,
  openXPlaneLogExternally as openXPlaneLogExternallyFn,
} from '@/lib/xplaneServices/log/ipc';
import type { Aircraft, WeatherPreset } from '@/types/aircraft';
import type { CliFlags } from '@/types/cli';
import type {
  AircraftHint,
  FlightDetail,
  FlightRecorderEvent,
  FlightSummary,
  LiveRecorderState,
} from '@/types/flightRecorder';
import type {
  ApiResponse,
  BrowseResult,
  NavDBStatus,
  NavLoadResult,
  NavSearchResult,
  PathSetResult,
  PathValidation,
} from '@/types/ipc';
import type { IvaoData } from '@/types/ivao';
import type { ResolvedAirportProcedures } from '@/types/navigation';
import type {
  ATCController,
  AirportMetadata,
  Airspace,
  HoldingPattern,
  Navaid,
  Waypoint,
} from '@/types/navigation';
import type { AirwaySegmentWithCoords } from '@/types/navigation';
import type { ThirdPartyNotices } from '@/types/notices';
import type { TrafficSnapshot } from '@/types/traffic';
import type { UpdateStatus } from '@/types/update';
import type { VatsimData, VatsimEventsResponse } from '@/types/vatsim';
import type { VatsimSectorCacheState, VatsimSectorQueryResult } from '@/types/vatsimSectors';
import type { LoadingProgress, PlaneState, XPlaneAPIResult } from '@/types/xplane';

type XPLogOpenResult = Awaited<ReturnType<typeof openXPlaneLogExternallyFn>>;

declare global {
  interface XPlaneInstallation {
    id: string;
    name: string;
    path: string;
  }

  interface Window {
    analyticsAPI: {
      getConsent: () => Promise<AnalyticsConsentState>;
      setConsent: (granted: boolean) => Promise<boolean>;
      track: <E extends AnalyticsEventName>(event: E, properties: AnalyticsEventProps<E>) => void;
    };
    appAPI: {
      platform: NodeJS.Platform;
      /** True when the UI runs in a browser on another device. */
      isRemoteClient: boolean;
      isSetupComplete: () => Promise<boolean>;
      getVersion: () => Promise<string>;
      getThirdPartyNotices: () => Promise<ThirdPartyNotices>;
      getUpdateStatus: () => Promise<UpdateStatus>;
      /** Asks the updater (Windows) and the download host for the newest version. */
      checkForUpdates: () => Promise<UpdateStatus>;
      /** Restarts into a downloaded update; false when none is ready. */
      installUpdate: () => Promise<boolean>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
      /** Opens the detached flight strip window, or closes it when open. */
      openFlightStripWindow: () => Promise<void>;
      isFlightStripWindowOpen: () => Promise<boolean>;
      /** 0.3 to 1; applied live to the open window and to the next one. */
      setFlightStripOpacity: (opacity: number) => Promise<void>;
      onFlightStripWindowOpen: (callback: (open: boolean) => void) => () => void;
      getCliFlags: () => Promise<CliFlags>;
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
      clipboardWrite: (text: string) => Promise<void>;
      clipboardWriteImage: (dataUrl: string) => Promise<boolean>;
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
      onOpenSettings: (callback: (tab: 'about' | null) => void) => () => void;
      setNativeLabels: (labels: import('@/lib/nativeShell/labels').NativeLabels) => void;
      /** Feeds the dock menu and jump list of recent airports. */
      noteAirportOpened: (icao: string, name: string) => void;
      /** Actions from xdispatch:// links while the app is running. */
      onAppAction: (callback: (action: AppAction) => void) => () => void;
      /** Links that arrived before the renderer listened; marks it as listening. */
      takePendingActions: () => Promise<AppAction[]>;
      pickDirectory: (opts?: { title?: string; defaultPath?: string }) => Promise<string | null>;
    };
    airportAPI: {
      getAirports: () => Promise<Airport[]>;
      getDistinctCountries: () => Promise<string[]>;
      getAirportData: (icao: string) => Promise<{ data: string; sourceFile: string } | null>;
      fetchMetar: (icao: string) => Promise<ApiResponse>;
      fetchTaf: (icao: string) => Promise<ApiResponse>;
      fetchGatewayReleases: () => Promise<ApiResponse>;
      fetchGatewayReleasePacks: (version: string) => Promise<ApiResponse>;
      fetchGatewayAirport: (icao: string) => Promise<ApiResponse>;
      fetchGatewayScenery: (sceneryId: number) => Promise<ApiResponse>;
      fetchVatsimData: () => Promise<{ data: VatsimData | null; error: string | null }>;
      fetchVatsimMetar: (icao: string) => Promise<ApiResponse>;
      fetchVatsimMetarsAll: () => Promise<ApiResponse>;
      fetchVatsimEvents: () => Promise<{ data: VatsimEventsResponse | null; error: string | null }>;
      fetchIvaoData: () => Promise<{ data: IvaoData | null; error: string | null }>;
    };
    vatsimSectorAPI: {
      getData: () => Promise<VatsimSectorQueryResult>;
      getStatus: () => Promise<VatsimSectorCacheState>;
      refresh: () => Promise<VatsimSectorQueryResult>;
      clearCache: () => Promise<{ success: boolean }>;
      onUpdated: (callback: () => void) => () => void;
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
      writeTaxiRoute: (
        json: string
      ) => Promise<{ success: boolean; path?: string; error?: string }>;
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
      getAirportProcedures: (icao: string) => Promise<ResolvedAirportProcedures | null>;
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
      launch: (
        payload: FlightInit,
        extraArgs?: string[]
      ) => Promise<import('@/lib/xplaneServices/launch').LaunchResult>;
      getAircraftImage: (imagePath: string) => Promise<string | null>;
    };
    flightPlanAPI: {
      openFile: () => Promise<{ content: string; fileName: string } | null>;
      /** Reads a .fms the OS handed to main (double-click, Open With); other paths are refused. */
      readFile: (
        path: string
      ) => Promise<
        | { content: string; fileName: string; error: null }
        | { content: null; fileName: null; error: string }
      >;
      /** Downloads a plan the user agreed to from a link; https only, 1 MB cap. */
      fetchRemote: (
        url: string
      ) => Promise<
        | { content: string; fileName: string; error: null }
        | { content: null; fileName: null; error: string }
      >;
      enrich: (
        fmsData: import('@/types/fms').FMSFlightPlan
      ) => Promise<import('@/types/fms').EnrichedFlightPlan | null>;
      resolveRoute: (draft: PlanDraft) => Promise<RouteResolveResult | null>;
      autoRoute: (request: AutoRouteRequest) => Promise<AutoRouteResult | null>;
      /** The North Atlantic track messages with their geometry and the download state. */
      oceanicTracks: () => Promise<NatFeed>;
      saveFms: (args: { stem: string; content: string }) => Promise<SaveFmsResult>;
    };
    simbriefAPI: {
      fetchLatest: (pilotId: string) => Promise<import('@/types/simbrief').SimBriefFetchResult>;
      downloadFmsFile: (args: {
        url: string;
        targetDir: string;
        filename: string;
      }) => Promise<{ success: true; path: string } | { success: false; error: string }>;
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
      setTrafficEnabled: (enabled: boolean) => Promise<XPlaneAPIResult>;
      onTrafficUpdate: (callback: (snapshot: TrafficSnapshot) => void) => () => void;
    };
    addonManagerAPI: {
      scenery: {
        analyze: () => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').SceneryEntry[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        sort: () => Promise<
          | { ok: true; value: { backupPath: string } }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        saveOrder: (
          folderNames: string[]
        ) => Promise<
          | { ok: true; value: { backupPath: string } }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        toggle: (
          folderName: string
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').SceneryEntry }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        deleteScenery: (
          folderName: string
        ) => Promise<
          | { ok: true; value: { wasSymlink: boolean } }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        move: (
          folderName: string,
          direction: 'up' | 'down'
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').SceneryEntry[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        backup: () => Promise<
          | { ok: true; value: string }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
        listBackups: () => Promise<{ path: string; timestamp: string }[]>;
        restore: (
          backupPath: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('@/lib/addonManager/core/types').SceneryError }
        >;
      };
      browser: {
        scanAircraft: () => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').AircraftInfo[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        toggleAircraft: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        deleteAircraft: (
          folderName: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        lockAircraft: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        scanPlugins: () => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').PluginInfo[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        togglePlugin: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        deletePlugin: (
          folderName: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        lockPlugin: (
          folderName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        scanLiveries: (
          aircraftFolder: string
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').LiveryInfo[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        deleteLivery: (
          aircraftFolder: string,
          liveryFolder: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        scanLuaScripts: () => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').LuaScriptInfo[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        toggleLuaScript: (
          fileName: string
        ) => Promise<
          | { ok: true; value: boolean }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        deleteLuaScript: (
          fileName: string
        ) => Promise<
          | { ok: true; value: void }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        checkAircraftUpdates: (
          aircraft: import('@/lib/addonManager/core/types').AircraftInfo[]
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').AircraftInfo[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
        >;
        checkPluginUpdates: (
          plugins: import('@/lib/addonManager/core/types').PluginInfo[]
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/core/types').PluginInfo[] }
          | { ok: false; error: import('@/lib/addonManager/core/types').BrowserError }
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
          | { ok: true; value: import('@/lib/addonManager/installer/types').DetectedItem[] }
          | { ok: false; error: import('@/lib/addonManager/installer/types').InstallerError }
        >;
        prepareInstall: (
          items: import('@/lib/addonManager/installer/types').DetectedItem[]
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/installer/types').InstallTask[] }
          | { ok: false; error: import('@/lib/addonManager/installer/types').InstallerError }
        >;
        install: (
          tasks: import('@/lib/addonManager/installer/types').InstallTask[]
        ) => Promise<
          | { ok: true; value: import('@/lib/addonManager/installer/types').InstallResult[] }
          | { ok: false; error: import('@/lib/addonManager/installer/types').InstallerError }
        >;
        onProgress: (
          callback: (progress: import('@/lib/addonManager/installer/types').InstallProgress) => void
        ) => () => void;
      };
    };
    debugAPI: {
      dbTables: () => Promise<
        Array<{
          name: string;
          rowCount: number;
          columns: Array<{ name: string; type: string }>;
        }>
      >;
      dbQuery: (
        table: string,
        limit: number,
        offset: number
      ) => Promise<{ columns: string[]; rows: unknown[][] }>;
      dbExec: (sql: string) => Promise<{ columns: string[]; rows: unknown[][]; error?: string }>;
    };
    companionAppsAPI: {
      launch: (input: {
        exePath: string;
        args?: string;
        cwd?: string;
      }) => Promise<import('@/lib/companionApps/spawn').SpawnResult>;
      browseForExe: (currentExePath?: string) => Promise<string | null>;
      isElevated: () => Promise<boolean>;
    };
    versions: { node: () => string; chrome: () => string; electron: () => string };
    remoteAccessAPI: {
      getStatus: () => Promise<RemoteAccessStatus>;
      setEnabled: (enabled: boolean) => Promise<RemoteAccessStatus>;
      resetToken: () => Promise<RemoteAccessStatus>;
      setPort: (port: number) => Promise<RemoteAccessStatus>;
      disconnectAll: () => Promise<RemoteAccessStatus>;
      onStatusChanged: (callback: (status: RemoteAccessStatus) => void) => () => void;
    };
    xpLogAPI: {
      read: () => Promise<XPLogReadResult>;
      openExternal: () => Promise<XPLogOpenResult>;
    };
    flightsAPI: {
      list: () => Promise<FlightSummary[]>;
      get: (id: string) => Promise<FlightDetail | null>;
      delete: (id: string) => Promise<void>;
      clear: () => Promise<void>;
      liveState: () => Promise<LiveRecorderState>;
      setAircraftHint: (hint: AircraftHint | null) => Promise<void>;
      setEnabled: (enabled: boolean) => Promise<void>;
      openFolder: () => Promise<string>;
      onEvent: (callback: (event: FlightRecorderEvent) => void) => () => void;
    };
  }
}
