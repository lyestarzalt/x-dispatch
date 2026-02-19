import { BrowserWindow, Menu, app, dialog, ipcMain, net, session, shell } from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'path';
import { updateElectronApp } from 'update-electron-app';
import { initDb } from './lib/db';
import { AirportProcedures } from './lib/parsers/nav/cifpParser';
import logger, { getLogPath } from './lib/utils/logger';
import {
  isInvalidCoords,
  isValidICAO,
  isValidRunway,
  isValidSceneryId,
  isValidSearchQuery,
  validateCoordinates,
} from './lib/utils/validation';
import { getXPlaneDataManager, isSetupComplete } from './lib/xplaneServices/dataService';
import type { LaunchConfig } from './types/aircraft';
import type { LoadingProgress, PlaneState } from './types/xplane';

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (process.platform === 'win32' && require('electron-squirrel-startup')) app.quit();

app.name = 'X-Dispatch';

let dataManager: ReturnType<typeof getXPlaneDataManager>;
let mainWindow: BrowserWindow | null = null;
let isLoading = false;
let launcherModule: typeof import('./lib/xplaneServices/launch') | null = null;
let xplaneModule: typeof import('./lib/xplaneServices/client') | null = null;

async function getXPlaneModule() {
  if (!xplaneModule) {
    xplaneModule = await import('./lib/xplaneServices/client');
  }
  return xplaneModule;
}

async function getLauncherModule() {
  if (!launcherModule) {
    launcherModule = await import('./lib/xplaneServices/launch');
  }
  return launcherModule;
}

function sendLoadingProgress(progress: LoadingProgress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('loading-progress', progress);
  }
}

async function proxyFetch(url: string): Promise<{ data: string | null; error: string | null }> {
  return new Promise((resolve) => {
    const request = net.request(url);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve({ data, error: null });
        } else {
          resolve({ data: null, error: `HTTP ${response.statusCode}` });
        }
      });
    });

    request.on('error', (error) => {
      resolve({ data: null, error: error.message });
    });

    request.end();
  });
}

function createWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icon.png');

  const windowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  const window = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0a0a',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  windowState.manage(window);
  window.once('ready-to-show', () => window.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}

function registerIpcHandlers() {
  ipcMain.handle('app:isSetupComplete', () => isSetupComplete());
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getLogPath', () => getLogPath());
  ipcMain.handle('app:openLogFile', () => {
    const logPath = getLogPath();
    shell.openPath(logPath);
  });
  ipcMain.handle('app:openLogFolder', () => {
    const logPath = getLogPath();
    shell.showItemInFolder(logPath);
  });
  ipcMain.handle('app:getConfigPath', () => app.getPath('userData'));
  ipcMain.handle('app:openConfigFolder', () => {
    shell.openPath(app.getPath('userData'));
  });
  ipcMain.handle('app:getLoadingStatus', () => ({
    xplanePath: dataManager.getXPlanePath(),
    status: dataManager.getStatus(),
  }));

  ipcMain.handle('app:startLoading', async () => {
    if (isLoading) {
      return { success: false, error: 'Loading already in progress' };
    }

    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) {
      sendLoadingProgress({
        step: 'config',
        status: 'error',
        message: 'X-Plane path not configured',
        error: 'Please configure X-Plane path in settings',
      });
      return { success: false, error: 'X-Plane path not configured' };
    }

    isLoading = true;
    logger.data.info(`Loading data from: ${xplanePath}`);
    const startTime = Date.now();

    try {
      // Detect data sources first (Navigraph vs X-Plane default)
      dataManager.detectDataSources(xplanePath);

      sendLoadingProgress({ step: 'airports', status: 'loading', message: 'Loading airports...' });
      await dataManager.loadAirportsOnly(xplanePath);
      sendLoadingProgress({
        step: 'airports',
        status: 'complete',
        message: 'Airports loaded',
        count: dataManager.getStatus().airports.count,
      });

      sendLoadingProgress({
        step: 'navaids',
        status: 'loading',
        message: 'Loading navigation aids...',
      });
      await dataManager.loadNavaidsOnly(xplanePath);
      sendLoadingProgress({
        step: 'navaids',
        status: 'complete',
        message: 'Navaids loaded',
        count: dataManager.getStatus().navaids.count,
      });

      sendLoadingProgress({
        step: 'waypoints',
        status: 'loading',
        message: 'Loading waypoints...',
      });
      await dataManager.loadWaypointsOnly(xplanePath);
      sendLoadingProgress({
        step: 'waypoints',
        status: 'complete',
        message: 'Waypoints loaded',
        count: dataManager.getStatus().waypoints.count,
      });

      sendLoadingProgress({
        step: 'airspaces',
        status: 'loading',
        message: 'Loading airspaces...',
      });
      await dataManager.loadAirspacesOnly(xplanePath);
      sendLoadingProgress({
        step: 'airspaces',
        status: 'complete',
        message: 'Airspaces loaded',
        count: dataManager.getStatus().airspaces.count,
      });

      sendLoadingProgress({ step: 'airways', status: 'loading', message: 'Loading airways...' });
      await dataManager.loadAirwaysOnly(xplanePath);
      sendLoadingProgress({
        step: 'airways',
        status: 'complete',
        message: 'Airways loaded',
        count: dataManager.getStatus().airways.count,
      });

      // Load optional data types (non-blocking)
      await Promise.allSettled([
        dataManager.loadATCDataOnly(xplanePath),
        dataManager.loadHoldingPatternsOnly(xplanePath),
        dataManager.loadAirportMetadataOnly(xplanePath),
      ]);

      sendLoadingProgress({ step: 'complete', status: 'complete', message: 'All data loaded' });
      logger.data.info(`Data loaded in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

      isLoading = false;
      return { success: true, status: dataManager.getStatus() };
    } catch (error) {
      logger.data.error('Data loading failed', error);
      sendLoadingProgress({
        step: 'error',
        status: 'error',
        message: 'Loading failed',
        error: (error as Error).message,
      });
      isLoading = false;
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('xplane:getPath', () => dataManager.getXPlanePath());
  ipcMain.handle('xplane:setPath', (_, p: string) => {
    // Security: Validate path parameter
    if (typeof p !== 'string' || p.length === 0 || p.length > 1000) {
      logger.security.warn(`Invalid X-Plane path parameter: ${typeof p}`);
      throw new Error('Invalid path');
    }
    // Prevent obvious path traversal attempts
    if (p.includes('..')) {
      logger.security.warn(`Blocked path traversal attempt in setPath: ${p}`);
      throw new Error('Invalid path');
    }
    return dataManager.setXPlanePath(p);
  });

  // Change X-Plane path and reload with clean state
  ipcMain.handle('xplane:changePath', (_, p: string) => {
    // Security: Validate path parameter
    if (typeof p !== 'string' || p.length === 0 || p.length > 1000) {
      logger.security.warn(`Invalid X-Plane path parameter: ${typeof p}`);
      return { success: false, errors: ['Invalid path'] };
    }
    if (p.includes('..')) {
      logger.security.warn(`Blocked path traversal attempt in changePath: ${p}`);
      return { success: false, errors: ['Invalid path'] };
    }

    const validation = dataManager.validatePath(p);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Clear all cached data (in-memory + SQLite)
    dataManager.clear();

    const result = dataManager.setXPlanePath(p);
    if (!result.success) {
      return result;
    }

    logger.main.info(`X-Plane path changed to: ${p}, clearing data and reloading...`);

    // Reload the window to trigger fresh data load
    if (mainWindow) {
      mainWindow.webContents.reload();
    }

    return { success: true, errors: [] };
  });

  ipcMain.handle('xplane:validatePath', (_, p: string) => dataManager.validatePath(p));
  ipcMain.handle('xplane:detectInstallations', () => dataManager.detectInstallations());
  ipcMain.handle('xplane:browseForPath', async () => {
    logger.main.info('browseForPath: called');

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Select X-Plane Installation Folder',
    };

    try {
      let result: Electron.OpenDialogReturnValue;

      if (mainWindow && !mainWindow.isDestroyed()) {
        // Ensure window is focused before showing dialog (fixes macOS issues)
        if (!mainWindow.isFocused()) {
          logger.main.info('browseForPath: focusing window first');
          mainWindow.focus();
        }
        logger.main.info('browseForPath: opening dialog with parent window');
        result = await dialog.showOpenDialog(mainWindow, dialogOptions);
      } else {
        // Fallback: show dialog without parent window
        logger.main.info('browseForPath: opening dialog without parent window');
        result = await dialog.showOpenDialog(dialogOptions);
      }

      logger.main.info(
        `browseForPath: dialog result - canceled: ${result.canceled}, paths: ${result.filePaths.length}`
      );
      if (result.canceled || result.filePaths.length === 0) return null;
      const selectedPath = result.filePaths[0];
      logger.main.info(`browseForPath: selected path: ${selectedPath}`);
      const validation = dataManager.validatePath(selectedPath);
      return { path: selectedPath, valid: validation.valid, errors: validation.errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.main.error(`browseForPath: dialog failed - ${errorMsg}`, err);
      throw new Error(`Failed to open folder picker: ${errorMsg}`);
    }
  });

  ipcMain.handle('get-airports', () => dataManager.getAllAirports());
  ipcMain.handle('get-airport-data', (_, icao: string) => {
    if (!isValidICAO(icao)) throw new Error('Invalid ICAO code');
    return dataManager.getAirportData(icao.toUpperCase());
  });

  ipcMain.handle('fetch-metar', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    return proxyFetch(
      `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao.toUpperCase())}&format=raw`
    );
  });

  ipcMain.handle('fetch-taf', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    return proxyFetch(
      `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao.toUpperCase())}&format=raw`
    );
  });

  ipcMain.handle('fetch-gateway-airport', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    return proxyFetch(
      `https://gateway.x-plane.com/apiv1/airport/${encodeURIComponent(icao.toUpperCase())}`
    );
  });

  ipcMain.handle('fetch-gateway-scenery', async (_, sceneryId: number) => {
    if (!isValidSceneryId(sceneryId)) return { data: null, error: 'Invalid scenery ID' };
    return proxyFetch(`https://gateway.x-plane.com/apiv1/scenery/${sceneryId}`);
  });

  ipcMain.handle('fetch-vatsim-data', async () => {
    const result = await proxyFetch('https://data.vatsim.net/v3/vatsim-data.json');
    if (result.data) {
      try {
        return { data: JSON.parse(result.data), error: null };
      } catch {
        return { data: null, error: 'Failed to parse VATSIM data' };
      }
    }
    return result;
  });

  ipcMain.handle('fetch-vatsim-metar', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    const result = await proxyFetch(
      `https://metar.vatsim.net/${encodeURIComponent(icao.toUpperCase())}`
    );
    return result;
  });

  ipcMain.handle('fetch-vatsim-events', async () => {
    const result = await proxyFetch('https://my.vatsim.net/api/v2/events/latest');
    if (result.data) {
      try {
        return { data: JSON.parse(result.data), error: null };
      } catch {
        return { data: null, error: 'Failed to parse VATSIM events' };
      }
    }
    return result;
  });

  ipcMain.handle('nav:loadDatabase', async (_, xplanePath?: string) => {
    try {
      const status = await dataManager.loadAll(xplanePath || undefined);
      return { success: true, status };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('nav:getStatus', () => dataManager.getStatus());

  ipcMain.handle('nav:getVORsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getVORsInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getNDBsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getNDBsInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getDMEsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getDMEsInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getILSInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getILSInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getGlideSlopesInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getGlideSlopesInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getMarkersInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getMarkersInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle(
    'nav:getILSComponentsInRadius',
    (_, lat: number, lon: number, radiusNm: number) => {
      const c = validateCoordinates(lat, lon, radiusNm);
      if (isInvalidCoords(c)) throw new Error(c.error);
      return dataManager.getILSComponentsInRadius(c.lat, c.lon, c.radius);
    }
  );

  ipcMain.handle('nav:getApproachAidsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getApproachAidsInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getApproachNavaidsByAirport', (_, airportIcao: string) => {
    if (!isValidICAO(airportIcao)) throw new Error('Invalid ICAO code');
    return dataManager.getApproachNavaidsByAirport(airportIcao.toUpperCase());
  });

  ipcMain.handle('nav:getApproachNavaidsByRunway', (_, airportIcao: string, runway: string) => {
    if (!isValidICAO(airportIcao)) throw new Error('Invalid ICAO code');
    if (!isValidRunway(runway)) throw new Error('Invalid runway identifier');
    return dataManager.getApproachNavaidsByRunway(airportIcao.toUpperCase(), runway.toUpperCase());
  });

  ipcMain.handle('nav:getWaypointsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getWaypointsInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getAirspacesNearPoint', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getAirspacesNearPoint(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getAllAirspaces', () => dataManager.getAllAirspaces());

  ipcMain.handle('nav:getAirwaysInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getAirwaysInRadius(c.lat, c.lon, c.radius);
  });

  ipcMain.handle('nav:getAllAirwaysWithCoords', () => dataManager.getAllAirwaysWithCoords());

  ipcMain.handle('nav:searchNavaids', (_, query: string, limit = 20) => {
    if (!isValidSearchQuery(query)) return [];
    return dataManager.searchNavaids(query, Math.min(Math.max(1, limit), 100));
  });

  ipcMain.handle('nav:getAirportProcedures', (_, icao: string): AirportProcedures | null => {
    if (!isValidICAO(icao)) return null;
    return dataManager.getAirportProcedures(icao.toUpperCase());
  });

  // New navigation data handlers
  ipcMain.handle('nav:getDataSources', () => dataManager.getDataSources());

  ipcMain.handle('nav:getATCByFacility', (_, facilityId: string) => {
    if (!facilityId || typeof facilityId !== 'string') return null;
    return dataManager.getATCByFacility(facilityId);
  });

  ipcMain.handle('nav:getAllATCControllers', () => dataManager.getAllATCControllers());

  ipcMain.handle('nav:getHoldingPatterns', (_, fixId: string) => {
    if (!fixId || typeof fixId !== 'string') return [];
    return dataManager.getHoldingPatternsForFix(fixId);
  });

  ipcMain.handle('nav:getAirportMetadata', (_, icao: string) => {
    if (!isValidICAO(icao)) return null;
    return dataManager.getAirportMetadata(icao.toUpperCase());
  });

  ipcMain.handle('nav:getTransitionAltitude', (_, icao: string) => {
    if (!isValidICAO(icao)) return null;
    return dataManager.getTransitionAltitude(icao.toUpperCase());
  });

  // Bulk data retrieval for map layers (with coordinates resolved)
  ipcMain.handle('nav:getAllHoldingPatterns', () => dataManager.getAllHoldingPatternsWithCoords());

  ipcMain.on('log:error', (_, msg: string, args: unknown[]) =>
    logger.error(`[Renderer] ${msg}`, ...args)
  );
  ipcMain.on('log:warn', (_, msg: string, args: unknown[]) =>
    logger.warn(`[Renderer] ${msg}`, ...args)
  );
  ipcMain.on('log:info', (_, msg: string, args: unknown[]) =>
    logger.info(`[Renderer] ${msg}`, ...args)
  );

  ipcMain.handle('launcher:scanAircraft', async () => {
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return { success: false, error: 'X-Plane path not configured', aircraft: [] };
    try {
      const { getLauncher } = await getLauncherModule();
      const aircraft = getLauncher(xplanePath).scanAircraft();
      return { success: true, aircraft };
    } catch (error) {
      return { success: false, error: (error as Error).message, aircraft: [] };
    }
  });

  ipcMain.handle('launcher:getAircraft', async () => {
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return [];
    const { getLauncher } = await getLauncherModule();
    return getLauncher(xplanePath).getAircraft();
  });

  ipcMain.handle('launcher:getWeatherPresets', async () => {
    const { WEATHER_PRESETS } = await getLauncherModule();
    return WEATHER_PRESETS;
  });

  ipcMain.handle('launcher:launch', async (_, config: unknown) => {
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return { success: false, error: 'X-Plane path not configured' };

    // Validate config has required LaunchConfig properties
    if (
      !config ||
      typeof config !== 'object' ||
      !('aircraft' in config) ||
      !('livery' in config) ||
      !('fuel' in config) ||
      !('startPosition' in config) ||
      !('time' in config) ||
      !('weather' in config)
    ) {
      return { success: false, error: 'Invalid launch configuration' };
    }

    try {
      const { getLauncher } = await getLauncherModule();
      return await getLauncher(xplanePath).launch(config as LaunchConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('launcher:getAircraftImage', async (_, imagePath: string) => {
    if (!imagePath || typeof imagePath !== 'string') return null;

    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return null;

    const allowedDir = path.resolve(xplanePath, 'Aircraft');
    const resolved = path.resolve(imagePath);

    if (!resolved.startsWith(allowedDir + path.sep)) {
      logger.security.warn(`Blocked unauthorized file access attempt: ${resolved}`);
      return null;
    }

    const ext = path.extname(imagePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.bmp', '.gif'].includes(ext)) {
      logger.security.warn(`Blocked non-image file access: ${resolved}`);
      return null;
    }

    try {
      const fs = await import('fs');
      if (!fs.existsSync(resolved)) return null;
      const data = fs.readFileSync(resolved);
      return `data:image/${ext.slice(1)};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  });

  // X-Plane API handlers (REST + WebSocket)
  // REST goes through main process to avoid CORS issues with localhost
  ipcMain.handle('xplaneService:isAPIAvailable', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().isAPIAvailable();
    } catch (error) {
      logger.main.error('Failed to check X-Plane API:', error);
      return false;
    }
  });

  ipcMain.handle('xplaneService:getCapabilities', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().getCapabilities();
    } catch (error) {
      logger.main.error('Failed to get capabilities:', error);
      return null;
    }
  });

  ipcMain.handle('xplaneService:startFlight', async (_, payload) => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().startFlight(payload);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('xplaneService:getDataref', async (_, datarefName: string) => {
    if (!datarefName || typeof datarefName !== 'string') return null;
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().getDataref(datarefName);
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    'xplaneService:setDataref',
    async (_, datarefName: string, value: number | number[]) => {
      if (!datarefName || typeof datarefName !== 'string') {
        return { success: false, error: 'Invalid dataref name' };
      }
      try {
        const { getXPlaneService } = await getXPlaneModule();
        return getXPlaneService().setDataref(datarefName, value);
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'xplaneService:activateCommand',
    async (_, commandName: string, duration: number = 0) => {
      if (!commandName || typeof commandName !== 'string') {
        return { success: false, error: 'Invalid command name' };
      }
      try {
        const { getXPlaneService } = await getXPlaneModule();
        return getXPlaneService().activateCommand(commandName, duration);
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // WebSocket streaming
  ipcMain.handle('xplaneService:startStateStream', async (event) => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      getXPlaneService().startStateStream(
        (state: PlaneState) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('xplaneService:stateUpdate', state);
          }
        },
        (connected: boolean) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('xplaneService:connectionChange', connected);
          }
        }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('xplaneService:stopStateStream', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      getXPlaneService().stopStateStream();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('xplaneService:isStreamConnected', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().isStreamConnected();
    } catch {
      return false;
    }
  });
}

app.whenReady().then(async () => {
  logger.main.info(`X-Dispatch v${app.getVersion()} starting`);
  logger.main.debug(`Log file: ${getLogPath()}`);

  if (app.isPackaged && process.platform === 'win32') {
    try {
      updateElectronApp({
        updateInterval: '10 minutes',
        notifyUser: true,
        logger: {
          log: (msg: string) => logger.main.info(`[AutoUpdate] ${msg}`),
          info: (msg: string) => logger.main.info(`[AutoUpdate] ${msg}`),
          warn: (msg: string) => logger.main.warn(`[AutoUpdate] ${msg}`),
          error: (msg: string) => logger.main.error(`[AutoUpdate] ${msg}`),
        },
      });
      logger.main.info('Auto-updater initialized');
    } catch (err) {
      logger.main.error('Failed to initialize auto-updater', err);
    }
  }

  // Load React DevTools in development
  if (!app.isPackaged && process.platform === 'darwin') {
    const os = await import('os');
    const reactDevToolsPath = path.join(
      os.homedir(),
      '/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi'
    );
    try {
      const fs = await import('fs');
      const versions = fs.readdirSync(reactDevToolsPath);
      if (versions.length > 0) {
        const latestVersion = versions.sort().pop();
        await session.defaultSession.loadExtension(path.join(reactDevToolsPath, latestVersion!));
        logger.main.info('React DevTools loaded');
      }
    } catch {
      // DevTools not installed, skip
    }
  }

  Menu.setApplicationMenu(null);
  await initDb();
  dataManager = getXPlaneDataManager();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['clipboard-read', 'clipboard-write'].includes(permission));
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; " +
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.arcgisonline.com https://server.arcgisonline.com https://s3.amazonaws.com;" +
            "font-src 'self' data: https://fonts.gstatic.com; " +
            "connect-src 'self' ws://localhost:* http://localhost:* https://avwx.rest https://gateway.x-plane.com https://*.tile.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.arcgisonline.com https://api.maptiler.com https://tiles.openfreemap.org https://s3.amazonaws.com; " +
            "worker-src 'self' blob:;",
        ],
      },
    });
  });

  registerIpcHandlers();
  mainWindow = createWindow();

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.png')
      : path.join(__dirname, '..', '..', 'assets', 'icon.png');
    app.dock.setIcon(iconPath);
  }

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== 'file:' &&
      parsedUrl.hostname !== 'localhost' &&
      parsedUrl.hostname !== '127.0.0.1'
    ) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});

// TODO: Revisit DB lifecycle management - ensure proper cleanup on all platforms
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    dataManager.close();
    app.quit();
  }
  // On macOS, keep DB open since app stays running
});

app.on('before-quit', () => {
  // Close DB when app is actually quitting (handles macOS Cmd+Q)
  dataManager.close();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
