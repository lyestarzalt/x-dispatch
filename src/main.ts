import {
  BrowserWindow,
  ClipboardItem,
  Menu,
  app,
  autoUpdater,
  clipboard,
  dialog,
  nativeTheme,
  net,
  screen,
  session,
  shell,
  systemPreferences,
} from 'electron';
import windowStateKeeper from 'electron-window-state';
import * as Sentry from '@sentry/electron/main';
import * as fs from 'fs';
import { execFile } from 'node:child_process';
import path from 'path';
import { UpdateSourceType, updateElectronApp } from 'update-electron-app';
import { CONTENT_SECURITY_POLICY } from './config/csp';
import { PROJECT_WEBSITE } from './config/links';
import { registerAddonManagerIPC } from './lib/addonManager/ipc';
import { scaleBucket, widthBucket } from './lib/analytics/buckets';
import { ANALYTICS_SHORTCUTS, type AnalyticsConsentState } from './lib/analytics/events';
import { initMainAnalytics } from './lib/analytics/mainAnalytics';
import { getCliFlags, parseAndApply, printHelpAndExit, printVersionAndExit } from './lib/cli';
import { registerCompanionAppsIPC } from './lib/companionApps/ipc';
import { getDbPath, getSqlite, initDb, recoverFromCorruption, saveDb } from './lib/db';
import { registerFlightRecorderIPC } from './lib/flightRecorder/ipc';
import { NAT_TRACK_RE } from './lib/flightplan/builder/routeTokens';
import { MENU_COMMANDS, type MenuCommand, buildAppMenuTemplate } from './lib/nativeShell/appMenu';
import {
  APP_URL_SCHEME,
  type AppAction,
  findAppUrlInArgv,
  parseAppUrl,
  remoteFileUrlOf,
} from './lib/nativeShell/appUrl';
import { createCrashRecovery } from './lib/nativeShell/crashRecovery';
import {
  DEFAULT_DESKTOP_PREFS,
  type DesktopPrefs,
  parseDesktopPrefs,
} from './lib/nativeShell/desktopPrefs';
import {
  findFmsFileInArgv,
  isFmsFileArg,
  windowsFmsRegistryCommands,
} from './lib/nativeShell/fileAssociations';
import {
  DEFAULT_NATIVE_LABELS,
  type NativeLabels,
  parseNativeLabels,
} from './lib/nativeShell/labels';
import { isAllowedNavigation } from './lib/nativeShell/navigationGuard';
import { createPendingActions } from './lib/nativeShell/pendingActions';
import {
  type RecentAirport,
  addRecentAirport,
  buildDockMenuTemplate,
  buildJumpListCategories,
  parseRecentAirports,
} from './lib/nativeShell/recentAirports';
import { initRemoteAccess, stopRemoteAccess } from './lib/remote';
import { broadcast, handle, on } from './lib/remote/handlerRegistry';
import { isDiskFullEvent } from './lib/sentry/diskFullErrors';
import { TRANSIENT_NET_ERROR_PATTERN } from './lib/sentry/transientNetErrors';
import { validateDownloadArgs } from './lib/simbrief/downloadValidation';
import {
  closeTileCache,
  getTileCache,
  initTileCache,
  registerTileCacheHandler,
  registerTileCacheScheme,
} from './lib/tileCache';
import { fetchCachedTile } from './lib/tileCache/fetchTile';
import { createUpdateStatusStore, parseLatestStableVersion } from './lib/updater/updateStatus';
import logger, { getLogPath } from './lib/utils/logger';
import { logStartupEnvironment } from './lib/utils/startupLog';
import {
  isInvalidCoords,
  isValidICAO,
  isValidRunway,
  isValidSceneryId,
  isValidSearchQuery,
  validateCoordinates,
} from './lib/utils/validation';
import {
  clearVatsimSectorData,
  getVatsimSectorData,
  getVatsimSectorStatus,
  onVatsimSectorDataUpdated,
  refreshVatsimSectorData,
} from './lib/vatsimSectors/service';
import { getXPlaneDataManager, isSetupComplete } from './lib/xplaneServices/dataService';
import { resyncCustomScenery } from './lib/xplaneServices/dataService/airports';
import {
  addInstallation,
  getActiveInstallation,
  getActiveInstallationName,
  getAnalyticsConsent,
  getInstallations,
  getSendCrashReports,
  removeInstallation,
  renameInstallation,
  setActiveInstallation,
  setAnalyticsConsent,
  setSendCrashReports,
} from './lib/xplaneServices/dataService/config';
import { loadRequiredStartupData } from './lib/xplaneServices/dataService/startupLoader';
import type { LaunchResult } from './lib/xplaneServices/launch';
import { registerXPlaneLogIPC } from './lib/xplaneServices/log/ipc';
import { ResolvedAirportProcedures } from './types/navigation';
import type { LoadingProgress, PlaneState } from './types/xplane';

/** Named NAT track fixes are looked up within this radius of the nearest track coordinate. */
const TRACK_FIX_SEARCH_NM = 1500;

// Squirrel.Windows runs the app for install, update and uninstall hooks (shortcut
// handling); those runs quit without booting so they never race the real instance.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run synchronously before any other code
const squirrelHookRun: boolean = require('electron-squirrel-startup');
if (squirrelHookRun) app.quit();

// CLI parsing — must run before Electron init so --help/--version can exit
// before any window opens. Unknown flags are logged but don't block boot.
const cliResult = parseAndApply(process.argv);
if (cliResult.flags.help) {
  printHelpAndExit(app.getVersion());
}
if (cliResult.flags.version) {
  printVersionAndExit(app.getVersion());
}
for (const u of cliResult.unknownWithSuggestions) {
  logger.main.warn(
    `Unknown flag: ${u.flag}${u.suggestion ? `. Did you mean ${u.suggestion}?` : ''}`
  );
}

// E2E test isolation: Playwright sets this env var to redirect userData (config.json,
// xplane-data.db, settings.json, logs) into a per-test temp dir. Must run BEFORE any
// app.getPath('userData') call below. Production users never set this — it's read-only
// from the parent process.
if (process.env.E2E_USER_DATA_DIR) {
  app.setPath('userData', process.env.E2E_USER_DATA_DIR);
}

// TODO: Memory optimization - consider lazy nav data loading, reduce sql.js footprint, limit MapLibre tile cache

// This reads config.json directly since getSendCrashReports() uses app.getPath which works before ready
const shouldInitSentry = (() => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.sendCrashReports ?? true; // Default: enabled (opt-out)
    }
    return true; // Default for new installs
  } catch {
    return true; // Default on error
  }
})();

if (shouldInitSentry) {
  Sentry.init({
    dsn: 'https://0279f306474c382f68b1605fb27be652@o4508345478742016.ingest.de.sentry.io/4510878234837072',
    environment: app.isPackaged ? 'production' : 'development',
    release: `x-dispatch@${app.getVersion()}`,
    tracesSampleRate: 1.0,
    integrations: [Sentry.startupTracingIntegration()],
    ignoreErrors: [TRANSIENT_NET_ERROR_PATTERN],
    beforeSend(event, hint) {
      // Disk-full failures describe the user's machine, not a defect here, and
      // every writer we have reports them differently — too path-dependent for
      // an ignoreErrors pattern, so they get dropped here instead.
      if (isDiskFullEvent(event, hint?.originalException)) return null;
      return event;
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (process.platform === 'win32' && require('electron-squirrel-startup')) app.quit();

app.name = 'X-Dispatch';

process.on('uncaughtExceptionMonitor', (error) => {
  logger.main.error('Uncaught exception in main process', error);
  recoverFromCorruption(error);
});

process.on('unhandledRejection', (reason) => {
  // A corrupt cache would fail every launch; rebuild it instead.
  if (recoverFromCorruption(reason)) return;
  logger.main.error(
    'Unhandled promise rejection in main process',
    reason instanceof Error ? reason : new Error(String(reason))
  );
});

app.on('render-process-gone', (_event, webContents, details) => {
  if (details.reason === 'clean-exit') return;

  let url: string | undefined;
  try {
    url = webContents.getURL();
  } catch {
    // Ignore inaccessible webContents metadata; the crash reason is enough.
  }
  // The URL carries the user's install path, so letting it reach the grouping
  // algorithm would shard one crash across every machine that hits it. Group on
  // the reason alone and keep the URL as message detail.
  Sentry.withScope((scope) => {
    scope.setFingerprint(['render-process-gone', details.reason]);
    logger.main.error(
      'Renderer process gone',
      new Error(
        [`reason=${details.reason}`, `exitCode=${details.exitCode}`, url ? `url=${url}` : null]
          .filter(Boolean)
          .join(', ')
      )
    );
  });

  recoverCrashedWindow(webContents);
});

app.on('child-process-gone', (_event, details) => {
  if (details.reason === 'clean-exit') return;

  // Group by what actually died. The Error is built at a single call site, so
  // without an explicit fingerprint Sentry buckets every child-process-gone
  // event into one issue — a GPU crash ends up indistinguishable from a routine
  // network-service restart. type/reason/service are all low-cardinality; the
  // exit code stays in the message as detail rather than splitting the group.
  Sentry.withScope((scope) => {
    scope.setFingerprint(
      ['child-process-gone', details.type, details.reason, details.serviceName].filter(
        (part): part is string => Boolean(part)
      )
    );
    logger.main.error(
      'Electron child process gone',
      new Error(
        [
          `type=${details.type}`,
          `reason=${details.reason}`,
          `exitCode=${details.exitCode}`,
          details.serviceName ? `service=${details.serviceName}` : null,
          details.name ? `name=${details.name}` : null,
        ]
          .filter(Boolean)
          .join(', ')
      )
    );
  });
});

let dataManager: ReturnType<typeof getXPlaneDataManager>;
let mainWindow: BrowserWindow | null = null;
let isLoading = false;
const sessionStartTime = Date.now();
const analytics = initMainAnalytics();
let launcherModule: typeof import('./lib/xplaneServices/launch') | null = null;
let xplaneModule: typeof import('./lib/xplaneServices/client') | null = null;
let isQuitting = false;
/** Translated by the renderer; English until its first push. */
let nativeLabels: NativeLabels = DEFAULT_NATIVE_LABELS;
const crashRecovery = createCrashRecovery();
/**
 * Actions from links, held until the renderer is listening. A link on a cold
 * start arrives before the window exists; the renderer drains the queue once
 * it mounts and takes later actions as pushes.
 */
const pendingAppActions = createPendingActions<AppAction>();
/** Files the OS asked us to open; the only paths `flightplan:readFile` will read. */
const openableFiles = new Set<string>();
let recentAirports: RecentAirport[] = [];
/** From Settings; defaults until the renderer's first push. */
let desktopPrefs: DesktopPrefs = DEFAULT_DESKTOP_PREFS;
/** Menu command ids as the analytics allow-list spells them. */
const MENU_COMMAND_ANALYTICS = Object.fromEntries(
  MENU_COMMANDS.map((c) => [c, c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)])
) as Record<MenuCommand, (typeof ANALYTICS_SHORTCUTS)[number]>;

/** A crashed main window would otherwise stay blank until the user restarts the app. */
function recoverCrashedWindow(webContents: Electron.WebContents): void {
  const win = mainWindow;
  if (isQuitting || !win || win.isDestroyed() || webContents !== win.webContents) return;

  if (crashRecovery.onCrash(Date.now()) === 'reload') {
    logger.main.warn('Reloading the main window after a renderer crash');
    win.webContents.reload();
    return;
  }

  const { crash } = nativeLabels;
  void dialog
    .showMessageBox(win, {
      type: 'error',
      message: crash.title,
      detail: crash.message,
      buttons: [crash.reload, crash.quit],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (win.isDestroyed()) return;
      if (response === 0) win.webContents.reload();
      else app.quit();
    });
}

/** Only the desktop window: a tablet must not have Settings pop open from the PC's menu. */
function openSettingsInMainWindow(tab: 'about' | null = null): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send('app:openSettings', tab);
}

function installAppMenu(): void {
  const template = buildAppMenuTemplate({
    platform: process.platform,
    isPackaged: app.isPackaged,
    appName: app.getName(),
    labels: nativeLabels.menu,
    actions: {
      openSettings: () => openSettingsInMainWindow(),
      checkForUpdates: () => {
        openSettingsInMainWindow('about');
        void checkForUpdatesNow();
      },
      openExternal: (url) => void shell.openExternal(url),
      toggleDevTools: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools(),
      command: runMenuCommand,
    },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * A menu item or its accelerator. What main can do itself it does here; the
 * rest goes to the desktop window's renderer, which owns the stores.
 */
function runMenuCommand(command: MenuCommand): void {
  analytics.track('shortcut_used', { shortcut: MENU_COMMAND_ANALYTICS[command] });
  const focused = BrowserWindow.getFocusedWindow();
  switch (command) {
    case 'closeWindow':
      // The flight strip has no dialogs to close first.
      if (focused && focused !== mainWindow) {
        focused.close();
        return;
      }
      break;
    case 'flightStripWindow':
      toggleFlightStripWindow();
      return;
    case 'focusSearch':
      // The toolbar listens on its own channel; the tablet gets it too.
      broadcast('focus-search');
      return;
    case 'openLogs':
      shell.showItemInFolder(getLogPath());
      return;
  }
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  if (command !== 'closeWindow') focusMainWindow();
  win.webContents.send('app:menuCommand', command);
}

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

/** One stream subscription per UI: a desktop window or a tablet. */
function streamSubscriberId(event: { sender: { id: string | number } }): string {
  return typeof event.sender.id === 'string' ? event.sender.id : `webcontents:${event.sender.id}`;
}

function sendLoadingProgress(progress: LoadingProgress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    broadcast('loading-progress', progress);
  }
}

/**
 * Default timeout for outbound HTTP requests proxied through the main
 * process. Keeps the app from silently hanging forever when an upstream
 * (e.g. IVAO API, VATSIM, AVWX) goes unreachable. Caller can override.
 */
const DEFAULT_PROXY_FETCH_TIMEOUT_MS = 15_000;

async function proxyFetch(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ data: string | null; error: string | null; statusCode?: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PROXY_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? Infinity;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const request = net.request(url);
    request.setHeader('User-Agent', `X-Dispatch/${app.getVersion()}`);
    let data = '';
    let received = 0;
    let settled = false;

    const settle = (result: { data: string | null; error: string | null; statusCode?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const elapsed = Date.now() - startedAt;
      if (result.error) {
        logger.main.warn(`proxyFetch ${url} failed in ${elapsed}ms: ${result.error}`);
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      // Aborting net.request fires the 'error' handler with "net::ERR_ABORTED";
      // we settle first with our own error so the caller sees "Timeout" instead.
      try {
        request.abort();
      } catch {
        // request may already be settling
      }
      settle({ data: null, error: `Timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          settle({ data: null, error: `Response larger than ${maxBytes} bytes` });
          try {
            request.abort();
          } catch {
            // already settling
          }
          return;
        }
        data += chunk.toString();
      });
      response.on('end', () => {
        if (response.statusCode === 200) {
          settle({ data, error: null, statusCode: response.statusCode });
        } else {
          settle({
            data: data || null,
            error: `HTTP ${response.statusCode}`,
            statusCode: response.statusCode,
          });
        }
      });
    });

    request.on('error', (error) => {
      settle({ data: null, error: error.message });
    });

    request.end();
  });
}

async function proxyDownload(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<{ data: Buffer | null; error: string | null; statusCode?: number }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PROXY_FETCH_TIMEOUT_MS;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const request = net.request(url);
    request.setHeader('User-Agent', `X-Dispatch/${app.getVersion()}`);
    const chunks: Buffer[] = [];
    let settled = false;

    const settle = (result: { data: Buffer | null; error: string | null; statusCode?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const elapsed = Date.now() - startedAt;
      if (result.error) {
        logger.main.warn(`proxyDownload ${url} failed in ${elapsed}ms: ${result.error}`);
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        request.abort();
      } catch {
        // request may already be settling
      }
      settle({ data: null, error: `Timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    request.on('response', (response) => {
      const statusCode = response.statusCode;
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        if (statusCode >= 200 && statusCode < 300) {
          settle({ data: Buffer.concat(chunks), error: null, statusCode });
        } else {
          settle({ data: null, error: `HTTP ${statusCode}`, statusCode });
        }
      });
      response.on('error', (err: Error) => settle({ data: null, error: err.message, statusCode }));
    });

    request.on('error', (err: Error) => settle({ data: null, error: err.message }));
    request.end();
  });
}

let flightStripWindow: BrowserWindow | null = null;
/** Set by the main window from the Appearance setting; window opacity is not supported on Linux. */
let flightStripOpacity = 1;

/**
 * A small frameless window with only the flight strip, kept above the simulator.
 * Not owned by the main window, so minimizing X-Dispatch leaves it on screen.
 */
function toggleFlightStripWindow(): void {
  // The same button closes it again.
  if (isFlightStripWindowOpen()) {
    flightStripWindow!.close();
    return;
  }
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icon.png');
  const windowState = windowStateKeeper({
    file: 'flight-strip-window.json',
    defaultWidth: 1000,
    defaultHeight: 120,
  });
  const win = new BrowserWindow({
    title: `${app.getName()} flight strip`,
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 260,
    minHeight: 40,
    frame: false,
    opacity: flightStripOpacity,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#06090D',
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
  windowState.manage(win);
  // The default level sits below a fullscreen simulator.
  const keepOnTop = () => {
    if (win.isDestroyed()) return;
    win.setAlwaysOnTop(true, 'screen-saver');
    win.moveTop();
  };
  keepOnTop();
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Another topmost window (the sim going fullscreen) can push it down; take the top back.
  win.on('blur', keepOnTop);
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?view=flight-strip`);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      query: { view: 'flight-strip' },
    });
  }
  win.on('closed', () => {
    flightStripWindow = null;
    broadcast('app:flightStripWindowOpen', false);
  });
  flightStripWindow = win;
  broadcast('app:flightStripWindowOpen', true);
}

function isFlightStripWindowOpen(): boolean {
  return !!flightStripWindow && !flightStripWindow.isDestroyed();
}

/** Window Controls Overlay (Windows, Linux): colours match the renderer's title bar. */
const TITLE_BAR_OVERLAY = {
  color: '#06090D',
  symbolColor: '#FFFFFF',
  /** The OS controls dim with the rest of the bar when the window is inactive. */
  symbolColorInactive: '#7C8594',
  height: 36,
} as const;

function createWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icon.png');

  const windowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800,
  });

  const isMac = process.platform === 'darwin';
  const window = new BrowserWindow({
    title: `${app.getName()} v${app.getVersion()} — [${getActiveInstallationName()}]`,
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#06090D',
    icon: iconPath,
    // A click on an inactive window acts at once instead of only focusing it.
    acceptFirstMouse: true,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac
      ? {}
      : {
          titleBarOverlay: {
            color: TITLE_BAR_OVERLAY.color,
            symbolColor: TITLE_BAR_OVERLAY.symbolColor,
            height: TITLE_BAR_OVERLAY.height,
          },
        }),
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

  window.on('page-title-updated', (e) => e.preventDefault());

  window.webContents.on('console-message', (details) => {
    if (app.isPackaged && details.level !== 'error' && details.level !== 'warning') return;

    const source = details.sourceId ? ` (${details.sourceId}:${details.lineNumber})` : '';
    const message = `[Renderer Console] ${details.message}${source}`;

    if (details.level === 'error') logger.error(message);
    else if (details.level === 'warning') logger.warn(message);
    else if (details.level === 'debug') logger.debug(message);
    else logger.info(message);
  });

  if (!app.isPackaged) {
    // titleBarStyle 'hidden' leaves the window without a native menu bar, so the default
    // menu's DevTools accelerators never reach it.
    window.webContents.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown') return;
      const isDevToolsKey =
        input.key === 'F12' ||
        ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i');
      if (isDevToolsKey) {
        window.webContents.toggleDevTools();
      }
    });

    // Only while DevTools are open — the native popup would otherwise steal
    // focus from the app's own context menus on every right-click.
    window.webContents.on('context-menu', (_event, params) => {
      if (!window.webContents.isDevToolsOpened()) return;
      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => window.webContents.inspectElement(params.x, params.y),
        },
      ]).popup({ window });
    });
  }

  windowState.manage(window);
  window.once('ready-to-show', () => window.show());

  // macOS: closing the window keeps the app in the Dock, like every single-window
  // Mac app; the next Dock click shows the same window with its state intact.
  window.on('close', (event) => {
    if (!isMac || isQuitting || !desktopPrefs.keepRunningOnClose) return;
    event.preventDefault();
    if (window.isFullScreen()) {
      window.once('leave-full-screen', () => window.hide());
      window.setFullScreen(false);
    } else {
      window.hide();
    }
  });

  // Native sheets (the crash dialog) attach below the custom title bar, not over it.
  if (isMac) window.setSheetOffset(TITLE_BAR_OVERLAY.height);

  // The renderer dims its title bar like a native window; the OS controls follow.
  const sendWindowFocus = (focused: boolean) => {
    if (window.isDestroyed()) return;
    window.webContents.send('app:windowFocus', focused);
    if (process.platform === 'win32') {
      window.setTitleBarOverlay({
        symbolColor: focused
          ? TITLE_BAR_OVERLAY.symbolColor
          : TITLE_BAR_OVERLAY.symbolColorInactive,
      });
    }
  };
  window.on('focus', () => {
    if (!isMac) window.flashFrame(false);
    sendWindowFocus(true);
  });
  window.on('blur', () => sendWindowFocus(false));

  // Full screen hides the traffic lights and the OS controls; the title bar follows.
  window.on('enter-full-screen', () => window.webContents.send('app:fullScreen', true));
  window.on('leave-full-screen', () => window.webContents.send('app:fullScreen', false));

  // A reload (crash recovery, dev HMR) drops the renderer's listeners: hold
  // app actions again until the new page drains the queue.
  window.webContents.on('did-start-loading', () => pendingAppActions.reset());

  // Every shortcut is a menu accelerator (lib/nativeShell/appMenu): one list, every OS.
  // Page zoom keys reach the Interface Zoom setting through the View menu.

  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
}

const DOWNLOADS_BASE_URL = 'https://dl.x-dispatch.app';
const LATEST_STABLE_URL = `${DOWNLOADS_BASE_URL}/latest.json`;
const UPDATE_RETRY_MS = 10 * 60_000;
const UPDATE_FIRST_CHECK_DELAY_MS = 5_000;

// Windows installs itself through Squirrel; macOS and Linux only get a notice.
const updateStatus = createUpdateStatusStore({
  managed: app.isPackaged && process.platform === 'win32',
});
updateStatus.subscribe((status) => broadcast('app:updateStatus', status));

async function refreshLatestVersion(): Promise<void> {
  const result = await proxyFetch(LATEST_STABLE_URL, { timeoutMs: 8_000 });
  if (!result.data || result.error) return;
  const latestVersion = parseLatestStableVersion(result.data);
  if (!latestVersion) {
    logger.main.warn('Update check: latest.json is not a stable release manifest');
    return;
  }
  updateStatus.patch({ latestVersion });
}

async function checkForUpdatesNow() {
  if (updateStatus.get().managed) startManagedUpdateCheck();
  await refreshLatestVersion();
  return updateStatus.get();
}

let updateRetryTimer: NodeJS.Timeout | null = null;
let autoUpdaterReady = false;

function startManagedUpdateCheck(): void {
  const { install } = updateStatus.get();
  if (!autoUpdaterReady) return;
  if (install === 'checking' || install === 'downloading' || install === 'ready') return;
  if (updateRetryTimer) {
    clearTimeout(updateRetryTimer);
    updateRetryTimer = null;
  }
  autoUpdater.checkForUpdates();
}

function initAutoUpdater(): void {
  try {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.StaticStorage,
        baseUrl: `${DOWNLOADS_BASE_URL}/win32/x64`,
      },
      // Also checks once right away; frequent polling only adds load on the download host.
      updateInterval: '4 hours',
      // The renderer offers the restart itself from the update status.
      notifyUser: false,
      logger: {
        log: (msg: string) => logger.main.info(`[AutoUpdate] ${msg}`),
        info: (msg: string) => logger.main.info(`[AutoUpdate] ${msg}`),
        warn: (msg: string) => logger.main.warn(`[AutoUpdate] ${msg}`),
        error: (msg: string) => logger.main.error(`[AutoUpdate] ${msg}`),
      },
    });
    autoUpdater.on('checking-for-update', () => {
      updateStatus.patch({ install: 'checking', error: null });
    });
    autoUpdater.on('update-available', () => {
      updateStatus.patch({ install: 'downloading', error: null });
      analytics.track('update_found', { method: 'auto' });
    });
    autoUpdater.on('update-not-available', () => {
      updateStatus.patch({ install: 'up-to-date', error: null });
    });
    autoUpdater.on('update-downloaded', (_event, _notes, releaseName) => {
      updateStatus.patch({ install: 'ready', installVersion: releaseName || null, error: null });
      analytics.track('update_downloaded', {});
      requestAttention();
    });
    autoUpdater.on('error', (err) => {
      updateStatus.patch({ install: 'error', error: err.message });
      // One failed check at startup should not cost the user the whole 4 hour interval.
      updateRetryTimer ??= setTimeout(() => {
        updateRetryTimer = null;
        startManagedUpdateCheck();
      }, UPDATE_RETRY_MS);
    });
    autoUpdaterReady = true;
    logger.main.info('Auto-updater initialized');
  } catch (err) {
    logger.main.error('Failed to initialize auto-updater', err);
  }
}

function registerIpcHandlers() {
  onVatsimSectorDataUpdated(() => {
    broadcast('vatsim-sectors:updated');
  });

  handle('app:isSetupComplete', () => isSetupComplete());
  handle('app:getVersion', () => app.getVersion());
  handle('app:getThirdPartyNotices', async () => {
    // Generated at build time by scripts/generate-third-party-notices.mjs into assets/licenses.
    const file = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'licenses', 'third-party-notices.json')
      : path.join(__dirname, '..', '..', 'assets', 'licenses', 'third-party-notices.json');
    try {
      return JSON.parse(await fs.promises.readFile(file, 'utf8')) as unknown;
    } catch (error) {
      logger.main.warn('Third-party notices unavailable', error);
      return { entries: [] };
    }
  });
  handle('app:getUpdateStatus', () => updateStatus.get());
  handle('app:checkForUpdates', () => checkForUpdatesNow());
  on('app:setNativeLabels', (event, labels: unknown) => {
    // Only the desktop window speaks for the menu's language.
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    nativeLabels = parseNativeLabels(labels);
    installAppMenu();
    refreshRecentsMenus();
  });
  on('app:setDesktopPrefs', (event, prefs: unknown) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    desktopPrefs = parseDesktopPrefs(prefs);
    refreshRecentsMenus();
  });
  on('app:requestAttention', (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    requestAttention();
  });
  on('app:airportOpened', (event, icao: unknown, name: unknown) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    if (typeof icao !== 'string' || !isValidICAO(icao)) return;
    recordRecentAirport(icao.toUpperCase(), typeof name === 'string' ? name.slice(0, 80) : '');
  });
  handle('app:installUpdate', () => {
    if (updateStatus.get().install !== 'ready') return false;
    autoUpdater.quitAndInstall();
    return true;
  });
  handle('app:openFlightStripWindow', () => toggleFlightStripWindow());
  handle('app:isFlightStripWindowOpen', () => isFlightStripWindowOpen());
  handle('app:setFlightStripOpacity', (_, opacity: unknown) => {
    if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return;
    flightStripOpacity = Math.max(0.3, Math.min(1, opacity));
    if (isFlightStripWindowOpen()) flightStripWindow!.setOpacity(flightStripOpacity);
  });
  handle('app:getCliFlags', () => getCliFlags());
  handle('app:getProcessMemory', () => {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    };
  });
  // The renderer takes whatever links arrived before it listened, then gets pushes.
  handle('app:takePendingActions', () => pendingAppActions.drain());
  // Double-click on the title bar: what the user set in System Settings on macOS
  // (zoom, minimise or nothing), maximise elsewhere.
  handle('app:titleBarDoubleClick', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const action =
      process.platform === 'darwin'
        ? systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string')
        : 'Maximize';
    if (action === 'None') return;
    if (action === 'Minimize') {
      win.minimize();
      return;
    }
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  handle('app:closeWindow', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  handle('app:getWindowState', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return {
      focused: win?.isFocused() ?? true,
      fullScreen: win?.isFullScreen() ?? false,
    };
  });

  // A flight plan the user agreed to download from a link: https only, small, and
  // parsed by the renderer like a file it opened itself.
  handle('flightplan:fetchRemote', async (_, rawUrl: unknown) => {
    const url = typeof rawUrl === 'string' ? remoteFileUrlOf(rawUrl) : undefined;
    if (!url) return { content: null, fileName: null, error: 'invalid_url' };
    const result = await proxyFetch(url, { timeoutMs: 10_000, maxBytes: 1024 * 1024 });
    if (!result.data || result.error) {
      return { content: null, fileName: null, error: result.error ?? 'empty' };
    }
    const fileName = path.basename(new URL(url).pathname) || 'flightplan.fms';
    return { content: result.data, fileName, error: null };
  });

  // A .fms the OS handed to main; any other path is refused, whatever the renderer says.
  handle('flightplan:readFile', async (_, rawPath: unknown) => {
    if (typeof rawPath !== 'string' || !openableFiles.has(rawPath)) {
      return { content: null, fileName: null, error: 'not_allowed' };
    }
    try {
      const stat = await fs.promises.stat(rawPath);
      if (stat.size > 1024 * 1024) return { content: null, fileName: null, error: 'too_large' };
      const content = await fs.promises.readFile(rawPath, 'utf-8');
      return { content, fileName: path.basename(rawPath), error: null };
    } catch (err) {
      logger.main.warn(`Could not read flight plan file: ${String(err)}`);
      return { content: null, fileName: null, error: 'read_failed' };
    }
  });

  handle('app:getLogPath', () => getLogPath());
  handle('app:openLogFile', () => {
    const logPath = getLogPath();
    shell.openPath(logPath);
  });
  handle('app:openLogFolder', () => {
    const logPath = getLogPath();
    shell.showItemInFolder(logPath);
  });
  handle('app:getConfigPath', () => app.getPath('userData'));
  handle('app:openConfigFolder', () => {
    shell.openPath(app.getPath('userData'));
  });
  handle('app:openPath', async (_, p: string) => {
    if (typeof p !== 'string' || p.includes('..') || p.length > 1000) {
      return;
    }
    // Folders open; files are only revealed, so this can never launch an executable.
    const stat = await fs.promises.stat(p).catch(() => null);
    if (!stat) return;
    if (stat.isDirectory()) {
      shell.openPath(p);
    } else {
      shell.showItemInFolder(p);
    }
  });
  handle('app:clipboardWrite', async (_, text: string) => {
    if (typeof text !== 'string') return;
    await clipboard.writeText(text);
  });
  handle('app:clipboardWriteImage', async (_, dataUrl: string) => {
    const prefix = 'data:image/png;base64,';
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) return false;
    const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64');
    if (bytes.length === 0) return false;
    try {
      const png = new Blob([bytes], { type: 'image/png' });
      await clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch (error) {
      logger.main.warn('Clipboard image write failed', error);
      return false;
    }
  });
  handle('app:openExternal', (_, url: string) => {
    // Security: Only allow http/https URLs
    if (typeof url !== 'string' || url.length > 2000) {
      return { success: false, error: 'Invalid URL' };
    }
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return { success: false, error: 'Only HTTP/HTTPS URLs are allowed' };
      }
      shell.openExternal(url);
      return { success: true };
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }
  });
  handle('analytics:getConsent', (): AnalyticsConsentState => {
    const consent = getAnalyticsConsent();
    // E2E runs never see the prompt, so it can't block automated UI flows.
    return { consent, shouldPrompt: consent === null && !process.env.E2E_USER_DATA_DIR };
  });
  handle('analytics:setConsent', (_, granted: unknown) => {
    if (typeof granted !== 'boolean') return false;
    const success = setAnalyticsConsent(granted);
    if (success) {
      logger.main.info(`Usage analytics ${granted ? 'enabled' : 'disabled'} by user`);
      analytics.onConsentChanged(granted);
    }
    return success;
  });
  // Renderer input is untrusted: track() validates it against the allowlist.
  on('analytics:track', (event, name: unknown, properties: unknown) =>
    analytics.track(name, properties, {
      remote: (event as { remote?: boolean }).remote === true,
    })
  );
  handle('app:getSendCrashReports', () => getSendCrashReports());
  handle('app:setSendCrashReports', (_, enabled: boolean) => {
    const success = setSendCrashReports(enabled);
    if (success) {
      logger.main.info(`Crash reporting ${enabled ? 'enabled' : 'disabled'} by user`);
    }
    return success;
  });
  handle('app:getLoadingStatus', () => ({
    xplanePath: dataManager.getXPlanePath(),
    status: dataManager.getStatus(),
  }));

  handle('app:getXPlaneVersion', () => dataManager.getXPlaneVersion());

  handle('app:clearCache', () => {
    logger.main.info('Clearing cache via IPC');
    dataManager.clearCache();
    getTileCache().clear();
    return { success: true };
  });

  handle('app:getTileCacheStats', () => getTileCache().getStats());

  // Debug: DB inspection (table list + paginated rows)
  handle('debug:dbTables', () => {
    const db = getSqlite();
    if (!db) return [];
    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name"
    );
    if (!result[0]) return [];
    return result[0].values.map(([name]) => {
      const countResult = db.exec(`SELECT COUNT(*) FROM "${name}"`);
      const count = countResult[0]?.values[0]?.[0] ?? 0;
      const colResult = db.exec(`PRAGMA table_info("${name}")`);
      const columns =
        colResult[0]?.values.map((r) => ({
          name: r[1] as string,
          type: r[2] as string,
        })) ?? [];
      return { name: name as string, rowCount: count as number, columns };
    });
  });

  handle('debug:dbQuery', (_, table: string, limit: number, offset: number) => {
    const db = getSqlite();
    if (!db) return { columns: [], rows: [] };
    // Validate table name to prevent SQL injection
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [
      table,
    ]);
    if (!tables[0]?.values.length) return { columns: [], rows: [] };
    const result = db.exec(
      `SELECT * FROM "${table}" LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
    );
    if (!result[0]) return { columns: [], rows: [] };
    return {
      columns: result[0].columns,
      rows: result[0].values,
    };
  });

  handle('debug:dbExec', (_, sql: string) => {
    const db = getSqlite();
    if (!db) return { columns: [], rows: [], error: 'No database' };
    try {
      const result = db.exec(sql);
      saveDb();
      if (!result[0]) return { columns: [], rows: [] };
      return { columns: result[0].columns, rows: result[0].values };
    } catch (err) {
      return { columns: [], rows: [], error: String(err) };
    }
  });

  /**
   * Build an i18n hint key for file access errors.
   * Returns undefined for unrecognized error codes.
   */
  function getFileErrorHintKey(error: unknown): string | undefined {
    const code = (error as NodeJS.ErrnoException).code;
    if (!code) return undefined;

    if (code === 'EPERM' || code === 'EACCES') {
      if (process.platform === 'darwin') return 'loading.hints.permissionMac';
      if (process.platform === 'win32') return 'loading.hints.permissionWindows';
      return 'loading.hints.permissionLinux';
    }

    if (code === 'EBUSY') return 'loading.hints.fileBusy';

    return undefined;
  }

  handle('app:startLoading', async () => {
    if (isLoading) {
      return { success: false, error: 'Loading already in progress' };
    }

    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) {
      sendLoadingProgress({
        step: 'config',
        status: 'error',
        messageKey: 'loading.pathNotConfigured',
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

      // Detect X-Plane version concurrently with first data load
      const versionPromise = dataManager.detectAndStoreVersion(xplanePath).catch(() => {});

      await loadRequiredStartupData(dataManager, xplanePath, sendLoadingProgress);

      // Ensure version is stored before loading completes
      await versionPromise;

      // Load optional data types (non-blocking)
      await Promise.allSettled([
        dataManager.loadATCDataOnly(xplanePath),
        dataManager.loadHoldingPatternsOnly(xplanePath),
        dataManager.loadAirportMetadataOnly(xplanePath),
      ]);

      sendLoadingProgress({
        step: 'complete',
        status: 'complete',
        messageKey: 'loading.messages.complete',
      });
      logger.data.info(`Data loaded in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

      isLoading = false;
      return { success: true, status: dataManager.getStatus() };
    } catch (error) {
      logger.data.error('Data loading failed', error);
      const hint = getFileErrorHintKey(error);
      sendLoadingProgress({
        step: 'error',
        status: 'error',
        messageKey: 'loading.messages.failed',
        error: (error as Error).message,
        hint,
      });
      isLoading = false;
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplane:getPath', () => dataManager.getXPlanePath());
  handle('xplane:setPath', (_, p: string) => {
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
  handle('xplane:changePath', (_, p: string) => {
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }

    return { success: true, errors: [] };
  });

  handle('xplane:validatePath', (_, p: string) => dataManager.validatePath(p));
  handle('xplane:detectInstallations', () => dataManager.detectInstallations());
  handle('xplane:browseForPath', async () => {
    logger.main.info('browseForPath: called');

    const configuredPath = dataManager.getXPlanePath();

    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Select X-Plane Installation Folder',
      defaultPath: configuredPath ? path.dirname(configuredPath) : undefined,
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
      const selectedPath = result.filePaths[0]!;
      logger.main.info(`browseForPath: selected path: ${selectedPath}`);
      const validation = dataManager.validatePath(selectedPath);
      return { path: selectedPath, valid: validation.valid, errors: validation.errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.main.error(`browseForPath: dialog failed - ${errorMsg}`, err);
      throw new Error(`Failed to open folder picker: ${errorMsg}`, { cause: err });
    }
  });

  // --- Multi-installation management ---
  handle('xplane:getInstallations', () => getInstallations());
  handle('xplane:getActiveInstallation', () => getActiveInstallation());
  handle('xplane:addInstallation', (_, name: string, installPath: string) => {
    if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
      throw new Error('Invalid installation name');
    }
    if (typeof installPath !== 'string' || installPath.length === 0 || installPath.length > 1000) {
      throw new Error('Invalid path');
    }
    const validation = dataManager.validatePath(installPath);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    const installation = addInstallation(name, installPath);
    return { success: true, installation };
  });
  handle('xplane:removeInstallation', (_, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid id');
    return removeInstallation(id);
  });
  handle('xplane:renameInstallation', (_, id: string, name: string) => {
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      name.length === 0 ||
      name.length > 100
    ) {
      throw new Error('Invalid parameters');
    }
    return renameInstallation(id, name);
  });
  handle('xplane:switchInstallation', (_, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid id');
    const success = setActiveInstallation(id);
    if (!success) return false;
    // Clear cached data and reload
    dataManager.clear();
    const installName = getActiveInstallationName();
    logger.main.info(`Switched to installation: ${installName}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(`${app.getName()} v${app.getVersion()} — ${installName}`);
      mainWindow.webContents.reload();
    }
    return true;
  });

  handle('get-airports', () => dataManager.getAllAirports());
  handle('data:getDistinctCountries', () => dataManager.getDistinctCountries());

  handle('airport:resync-custom', async () => {
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return { synced: false, count: 0, diff: 0 };
    try {
      const result = await resyncCustomScenery(xplanePath);
      if (result.diff !== 0) {
        broadcast('airports-updated');
      }
      return { synced: true, ...result };
    } catch (err) {
      logger.main.error('Custom scenery resync failed', err);
      return { synced: false, count: 0, diff: 0 };
    }
  });
  handle('get-airport-data', (_, icao: string) => {
    if (!isValidICAO(icao)) throw new Error('Invalid ICAO code');
    logger.main.info(`[User] Airport selected: ${icao.toUpperCase()}`);
    return dataManager.getAirportData(icao.toUpperCase());
  });

  handle('fetch-metar', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    return proxyFetch(
      `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao.toUpperCase())}&format=raw`
    );
  });

  handle('fetch-taf', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    return proxyFetch(
      `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao.toUpperCase())}&format=raw`
    );
  });

  handle('fetch-gateway-releases', async () => {
    return proxyFetch('https://gateway.x-plane.com/apiv1/releases');
  });

  handle('fetch-gateway-release-packs', async (_, version: string) => {
    if (!/^\d+\.\d+(\.\d+)?$/.test(version)) return { data: null, error: 'Invalid version format' };
    return proxyFetch(`https://gateway.x-plane.com/apiv1/release/${encodeURIComponent(version)}`);
  });

  handle('fetch-gateway-airport', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    return proxyFetch(
      `https://gateway.x-plane.com/apiv1/airport/${encodeURIComponent(icao.toUpperCase())}`
    );
  });

  handle('fetch-gateway-scenery', async (_, sceneryId: number) => {
    if (!isValidSceneryId(sceneryId)) return { data: null, error: 'Invalid scenery ID' };
    return proxyFetch(`https://gateway.x-plane.com/apiv1/scenery/${sceneryId}`);
  });

  handle('fetch-vatsim-data', async () => {
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

  handle('fetch-ivao-data', async () => {
    const result = await proxyFetch('https://api.ivao.aero/v2/tracker/whazzup');
    if (result.data) {
      try {
        return { data: JSON.parse(result.data), error: null };
      } catch {
        return { data: null, error: 'Failed to parse IVAO data' };
      }
    }
    return result;
  });

  handle('fetch-vatsim-metar', async (_, icao: string) => {
    if (!isValidICAO(icao)) return { data: null, error: 'Invalid ICAO code' };
    const result = await proxyFetch(
      `https://metar.vatsim.net/${encodeURIComponent(icao.toUpperCase())}`
    );
    return result;
  });

  handle('fetch-vatsim-metars-all', async () => {
    return proxyFetch('https://metar.vatsim.net/metar.php?id=all');
  });

  handle('fetch-vatsim-events', async () => {
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

  handle('vatsim-sectors:getData', async () => {
    return getVatsimSectorData();
  });

  handle('vatsim-sectors:getStatus', async () => {
    return getVatsimSectorStatus();
  });

  handle('vatsim-sectors:refresh', async () => {
    return refreshVatsimSectorData();
  });

  handle('vatsim-sectors:clearCache', () => {
    return clearVatsimSectorData();
  });

  handle('nav:loadDatabase', async (_, xplanePath?: string) => {
    try {
      const status = await dataManager.loadAll(xplanePath || undefined);
      return { success: true, status };
    } catch (error) {
      logger.data.error('Manual nav database load failed', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('nav:getStatus', () => dataManager.getStatus());

  handle('nav:getVORsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getVORsInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getNDBsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getNDBsInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getDMEsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getDMEsInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getILSInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getILSInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getGlideSlopesInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getGlideSlopesInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getMarkersInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getMarkersInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getILSComponentsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getILSComponentsInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getApproachAidsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getApproachAidsInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getApproachNavaidsByAirport', (_, airportIcao: string) => {
    if (!isValidICAO(airportIcao)) throw new Error('Invalid ICAO code');
    return dataManager.getApproachNavaidsByAirport(airportIcao.toUpperCase());
  });

  handle('nav:getApproachNavaidsByRunway', (_, airportIcao: string, runway: string) => {
    if (!isValidICAO(airportIcao)) throw new Error('Invalid ICAO code');
    if (!isValidRunway(runway)) throw new Error('Invalid runway identifier');
    return dataManager.getApproachNavaidsByRunway(airportIcao.toUpperCase(), runway.toUpperCase());
  });

  handle('nav:getWaypointsInRadius', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getWaypointsInRadius(c.lat, c.lon, c.radius);
  });

  handle('nav:getAirspacesNearPoint', (_, lat: number, lon: number, radiusNm: number) => {
    const c = validateCoordinates(lat, lon, radiusNm);
    if (isInvalidCoords(c)) throw new Error(c.error);
    return dataManager.getAirspacesNearPoint(c.lat, c.lon, c.radius);
  });

  handle('nav:getAllAirspaces', () => dataManager.getAllAirspaces());

  // Airways are queried by name for flight plans (no more global display)
  handle('nav:getAirwaySegments', (_, airwayName: string) => {
    if (!airwayName || typeof airwayName !== 'string' || airwayName.length > 10) return [];
    return dataManager.getAirwaySegments(airwayName.toUpperCase());
  });

  handle('nav:searchNavaids', (_, query: string, limit = 20) => {
    if (!isValidSearchQuery(query)) return [];
    return dataManager.searchNavaids(query, Math.min(Math.max(1, limit), 100));
  });

  handle('nav:getAirportProcedures', (_, icao: string): ResolvedAirportProcedures | null => {
    if (!isValidICAO(icao)) return null;
    const procedures = dataManager.getAirportProcedures(icao.toUpperCase());
    if (procedures) {
      logger.main.info(
        `[User] Loaded procedures for ${icao.toUpperCase()}: ${procedures.sids.length} SIDs, ${procedures.stars.length} STARs, ${procedures.approaches.length} approaches`
      );
    }
    return procedures;
  });

  // New navigation data handlers
  handle('nav:getDataSources', () => dataManager.getDataSources());

  handle('nav:getATCByFacility', (_, facilityId: string) => {
    if (!facilityId || typeof facilityId !== 'string') return null;
    return dataManager.getATCByFacility(facilityId);
  });

  handle('nav:getAllATCControllers', () => dataManager.getAllATCControllers());

  handle('nav:getHoldingPatterns', (_, fixId: string) => {
    if (!fixId || typeof fixId !== 'string') return [];
    return dataManager.getHoldingPatternsForFix(fixId);
  });

  handle('nav:getAirportMetadata', (_, icao: string) => {
    if (!isValidICAO(icao)) return null;
    return dataManager.getAirportMetadata(icao.toUpperCase());
  });

  handle('nav:getTransitionAltitude', (_, icao: string) => {
    if (!isValidICAO(icao)) return null;
    return dataManager.getTransitionAltitude(icao.toUpperCase());
  });

  // Bulk data retrieval for map layers (with coordinates resolved)
  handle('nav:getAllHoldingPatterns', () => dataManager.getAllHoldingPatternsWithCoords());

  // ==========================================================================
  // Bounds-based queries (SQLite direct - more efficient for large datasets)
  // ==========================================================================

  handle(
    'nav:getNavaidsInBounds',
    (
      _,
      minLat: number,
      maxLat: number,
      minLon: number,
      maxLon: number,
      types?: string[],
      limit?: number
    ) => {
      return dataManager.getNavaidsInBoundsSql(minLat, maxLat, minLon, maxLon, types, limit);
    }
  );

  handle(
    'nav:getWaypointsInBounds',
    (_, minLat: number, maxLat: number, minLon: number, maxLon: number, limit?: number) => {
      return dataManager.getWaypointsInBoundsSql(minLat, maxLat, minLon, maxLon, limit);
    }
  );

  handle(
    'nav:resolveWaypointCoords',
    (_, waypointId: string, region?: string, airportLat?: number, airportLon?: number) => {
      if (!waypointId || typeof waypointId !== 'string') return null;
      return dataManager.resolveWaypointCoords(waypointId, region, airportLat, airportLon);
    }
  );

  handle(
    'nav:resolveNavaidCoords',
    (_, navaidId: string, region?: string, airportLat?: number, airportLon?: number) => {
      if (!navaidId || typeof navaidId !== 'string') return null;
      return dataManager.resolveNavaidCoords(navaidId, region, airportLat, airportLon);
    }
  );

  on('log:error', (_, msg: string, args: unknown[]) => logger.error(`[Renderer] ${msg}`, ...args));
  on('log:warn', (_, msg: string, args: unknown[]) => logger.warn(`[Renderer] ${msg}`, ...args));
  on('log:info', (_, msg: string, args: unknown[]) => logger.info(`[Renderer] ${msg}`, ...args));

  // Flight plan file handling
  handle('flightplan:openFile', async () => {
    const xplanePath = dataManager.getXPlanePath();
    const defaultPath = xplanePath ? path.join(xplanePath, 'Output', 'FMS plans') : undefined;

    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Open Flight Plan',
      defaultPath,
      filters: [
        { name: 'X-Plane Flight Plans', extensions: ['fms'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };

    try {
      let result: Electron.OpenDialogReturnValue;
      if (mainWindow && !mainWindow.isDestroyed()) {
        result = await dialog.showOpenDialog(mainWindow, dialogOptions);
      } else {
        result = await dialog.showOpenDialog(dialogOptions);
      }

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0]!;
      app.addRecentDocument(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      return { content, fileName };
    } catch (err) {
      logger.main.error('Failed to open flight plan file', err);
      return null;
    }
  });

  handle('flightplan:enrich', async (_, fmsData: unknown) => {
    try {
      // Lazy import to avoid loading at startup
      const { enrichFlightPlan } = await import('./lib/flightplan/fmsResolver');
      const ourCycle = dataManager.getDataSources()?.global?.cycle ?? undefined;
      return enrichFlightPlan(fmsData as import('./types/fms').FMSFlightPlan, ourCycle);
    } catch (err) {
      logger.main.error('Failed to enrich flight plan', err);
      return null;
    }
  });

  handle('flightplan:resolveRoute', async (_, draft: unknown) => {
    try {
      const { resolveRoute } = await import('./lib/flightplan/builder/routeResolver');
      const { enrichFlightPlan } = await import('./lib/flightplan/fmsResolver');
      const { refreshOceanicTracks } = await import('./lib/flightplan/builder/oceanicTracks');
      await refreshOceanicTracks();
      const cycle = dataManager.getDataSources()?.global?.cycle ?? undefined;
      const resolution = resolveRoute(
        draft as import('./lib/flightplan/builder/types').PlanDraft,
        cycle
      );
      if (!resolution) return null;
      return { ...resolution, enriched: enrichFlightPlan(resolution.plan, cycle) };
    } catch (err) {
      logger.main.error('Failed to resolve route', err);
      return null;
    }
  });

  handle('flightplan:autoRoute', async (_, request: unknown) => {
    try {
      const { autoRoute } = await import('./lib/flightplan/builder/autoRouter');
      const { refreshOceanicTracks } = await import('./lib/flightplan/builder/oceanicTracks');
      await refreshOceanicTracks();
      const { departure, arrival, cruiseAltitudeFt, routeFrom, routeTo, exits, entries, track } =
        request as import('./lib/flightplan/builder/types').AutoRouteRequest;
      if (!departure || !arrival) return null;
      const startedAt = Date.now();
      const result = autoRoute({
        departure,
        arrival,
        from: routeFrom ?? departure,
        to: routeTo ?? arrival,
        exits,
        entries,
        cruiseAltitudeFt,
        track: typeof track === 'string' && NAT_TRACK_RE.test(track) ? track : undefined,
        trace: (message) => logger.main.debug(`Auto route pass ${message}`),
      });
      logger.main.info(
        `Auto route ${departure.icao}-${arrival.icao}: ${result ? 'found' : 'none'} in ${Date.now() - startedAt}ms`
      );
      return result;
    } catch (err) {
      logger.main.error('Auto route failed', err);
      return null;
    }
  });

  handle('flightplan:oceanicTracks', async () => {
    try {
      const { refreshOceanicTracks, resolvedFeed } =
        await import('./lib/flightplan/builder/oceanicTracks');
      const { getWaypointNearestById } =
        await import('./lib/xplaneServices/dataService/navdata/navCache');
      await refreshOceanicTracks();
      return resolvedFeed((id, near) =>
        getWaypointNearestById(id, near.latitude, near.longitude, TRACK_FIX_SEARCH_NM)
      );
    } catch (err) {
      logger.main.error('Failed to load NAT tracks', err);
      const reason = err instanceof Error ? err.message : String(err);
      return { messages: [], fetchedAt: null, error: reason };
    }
  });

  handle('flightplan:saveFms', async (_, args: { stem?: unknown; content?: unknown }) => {
    const stem = typeof args?.stem === 'string' ? args.stem.replace(/[^A-Za-z0-9_-]/g, '') : '';
    const content = typeof args?.content === 'string' ? args.content : '';
    if (!stem || !content || content.length > 1_000_000) {
      return { success: false, error: 'Invalid flight plan' };
    }
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return { success: false, error: 'X-Plane path is not set' };
    const dir = path.join(xplanePath, 'Output', 'FMS plans');
    const target = path.join(dir, `${stem}.fms`);
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(target, content, 'utf-8');
      logger.main.info(`Flight plan written to ${target}`);
      return { success: true, path: target };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logger.main.warn(`Flight plan write failed for ${target}: ${reason}`);
      return { success: false, error: reason };
    }
  });

  // SimBrief API
  handle('simbrief:fetchLatest', async (_, pilotId: string) => {
    // Validate pilot ID
    if (!pilotId || typeof pilotId !== 'string') {
      return { success: false, error: 'Invalid pilot ID' };
    }
    if (!/^\d{1,10}$/.test(pilotId)) {
      return { success: false, error: 'Pilot ID must be numeric' };
    }

    try {
      const url = `https://www.simbrief.com/api/xml.fetcher.php?userid=${encodeURIComponent(pilotId)}&json=1`;
      const result = await proxyFetch(url);

      if (!result.data) {
        return { success: false, error: result.error || 'No data received' };
      }

      const data = JSON.parse(result.data);

      // Check for SimBrief error response (API returns 400 with error details)
      if (data.fetch?.status?.startsWith('Error')) {
        const msg = data.fetch.status.replace(/^Error:\s*/, '');
        if (msg.toLowerCase().includes('no flight plan on file')) {
          return {
            success: false,
            error: 'No flight plan found. Generate one on simbrief.com first.',
          };
        }
        return { success: false, error: msg };
      }

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, data };
    } catch (err) {
      logger.main.error('Failed to fetch SimBrief flight plan', err);
      return { success: false, error: 'Failed to fetch flight plan' };
    }
  });

  handle(
    'simbrief:downloadFmsFile',
    async (_, args: { url: string; targetDir: string; filename: string }) => {
      const validated = validateDownloadArgs(args ?? {});
      if (!validated.ok) {
        logger.main.warn(
          `downloadFmsFile rejected args: ${validated.error} (filename=${JSON.stringify((args ?? {}).filename)})`
        );
        return { success: false, error: validated.error };
      }
      const { url, targetDir, filename } = validated;

      const startedAt = Date.now();
      try {
        await fs.promises.mkdir(targetDir, { recursive: true });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.main.warn(`downloadFmsFile mkdir failed for ${targetDir}: ${reason}`);
        return { success: false, error: `Couldn't create folder: ${reason}` };
      }

      const result = await proxyDownload(url);
      if (!result.data) {
        return { success: false, error: result.error ?? 'Download failed' };
      }

      const targetPath = path.join(targetDir, filename);
      try {
        await fs.promises.writeFile(targetPath, result.data);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.main.warn(`downloadFmsFile write failed for ${targetPath}: ${reason}`);
        return { success: false, error: `Couldn't write file: ${reason}` };
      }

      const elapsed = Date.now() - startedAt;
      logger.main.info(
        `downloadFmsFile wrote ${filename} to ${targetDir} (${result.data.length} bytes) in ${elapsed}ms`
      );
      return { success: true, path: targetPath };
    }
  );

  handle('app:pickDirectory', async (_, opts?: { title?: string; defaultPath?: string }) => {
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: opts?.title ?? 'Select folder',
      defaultPath: opts?.defaultPath,
    };

    try {
      const result =
        mainWindow && !mainWindow.isDestroyed()
          ? await dialog.showOpenDialog(mainWindow, dialogOptions)
          : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0]!;
    } catch (err) {
      logger.main.error('app:pickDirectory failed', err);
      return null;
    }
  });

  handle('launcher:scanAircraft', async () => {
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return { success: false, error: 'X-Plane path not configured', aircraft: [] };
    try {
      const { getLauncher } = await getLauncherModule();
      const aircraft = await getLauncher(xplanePath).scanAircraft();
      return { success: true, aircraft };
    } catch (error) {
      logger.launcher.error('Failed to scan aircraft', error);
      return { success: false, error: (error as Error).message, aircraft: [] };
    }
  });

  handle('launcher:getAircraft', async () => {
    const xplanePath = dataManager.getXPlanePath();
    if (!xplanePath) return [];
    try {
      const { getLauncher } = await getLauncherModule();
      return getLauncher(xplanePath).getAircraft();
    } catch (error) {
      logger.launcher.error('Failed to get aircraft', error);
      return [];
    }
  });

  handle('launcher:getWeatherPresets', async () => {
    const { WEATHER_PRESETS } = await getLauncherModule();
    return WEATHER_PRESETS;
  });

  handle(
    'launcher:launch',
    async (_, payload: unknown, extraArgs?: string[]): Promise<LaunchResult> => {
      const xplanePath = dataManager.getXPlanePath();
      if (!xplanePath) {
        return {
          success: false,
          error: 'X-Plane path not configured',
          code: 'PATH_NOT_CONFIGURED',
        };
      }

      const flightPayload =
        payload as import('./lib/xplaneServices/client/generated/xplaneApi').FlightInit;
      const aircraftPath = flightPayload?.aircraft?.path || 'unknown';
      const airport =
        flightPayload?.ramp_start?.airport_id ||
        flightPayload?.runway_start?.airport_id ||
        'unknown';
      logger.launcher.info(`[User] Launch attempt: ${aircraftPath} at ${airport}`);

      try {
        const { getLauncher } = await getLauncherModule();
        const result = await getLauncher(xplanePath).launch(flightPayload, extraArgs);
        if (result.success) {
          logger.launcher.info('[User] Launch successful');
        } else {
          logger.launcher.error(`[User] Launch failed: ${result.code} — ${result.error}`);
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.launcher.error(`[User] Launch exception: ${message}`);
        return { success: false, error: message, code: 'SPAWN_FAILED' };
      }
    }
  );

  handle('launcher:getAircraftImage', async (_, imagePath: string) => {
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
      const data = await fs.promises.readFile(resolved);
      return `data:image/${ext.slice(1)};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  });

  // X-Plane API handlers (REST + WebSocket)
  // REST goes through main process to avoid CORS issues with localhost
  handle('xplaneService:isAPIAvailable', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().isAPIAvailable();
    } catch (error) {
      logger.main.error('Failed to check X-Plane API:', error);
      return false;
    }
  });

  handle('xplaneService:getCapabilities', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().getCapabilities();
    } catch (error) {
      logger.main.error('Failed to get capabilities:', error);
      return null;
    }
  });

  handle('xplaneService:startFlight', async (_, payload) => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().startFlight(payload);
    } catch (error) {
      logger.main.error('Failed to start X-Plane flight', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplaneService:getDataref', async (_, datarefName: string) => {
    if (!datarefName || typeof datarefName !== 'string') return null;
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().getDataref(datarefName);
    } catch {
      return null;
    }
  });

  handle('xplaneService:setDataref', async (_, datarefName: string, value: number | number[]) => {
    if (!datarefName || typeof datarefName !== 'string') {
      return { success: false, error: 'Invalid dataref name' };
    }
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().setDataref(datarefName, value);
    } catch (error) {
      logger.main.error('Failed to set X-Plane dataref', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplaneService:activateCommand', async (_, commandName: string, duration: number = 0) => {
    if (!commandName || typeof commandName !== 'string') {
      return { success: false, error: 'Invalid command name' };
    }
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().activateCommand(commandName, duration);
    } catch (error) {
      logger.main.error('Failed to activate X-Plane command', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // WebSocket streaming
  handle('xplaneService:startStateStream', async (event) => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      const sender = event.sender;
      getXPlaneService().startStateStream(streamSubscriberId(event), {
        onUpdate: (state: PlaneState) => {
          if (!sender.isDestroyed()) sender.send('xplaneService:stateUpdate', state);
        },
        onConnectionChange: (connected: boolean) => {
          if (!sender.isDestroyed()) sender.send('xplaneService:connectionChange', connected);
        },
        onStateClear: () => {
          if (!sender.isDestroyed()) sender.send('xplaneService:stateClear');
        },
      });
      return { success: true };
    } catch (error) {
      logger.main.error('Failed to start X-Plane state stream', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplaneService:setTrafficEnabled', async (event, enabled: boolean) => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      const sender = event.sender;
      getXPlaneService().setTrafficEnabled(
        streamSubscriberId(event),
        enabled === true,
        (snapshot) => {
          if (!sender.isDestroyed()) sender.send('xplaneService:trafficUpdate', snapshot);
        }
      );
      return { success: true };
    } catch (error) {
      logger.main.error('Failed to toggle X-Plane traffic stream', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplaneService:stopStateStream', async (event) => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      getXPlaneService().stopStateStream(streamSubscriberId(event));
      return { success: true };
    } catch (error) {
      logger.main.error('Failed to stop X-Plane state stream', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplaneService:forceReconnect', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      getXPlaneService().forceReconnect();
      return { success: true };
    } catch (error) {
      logger.main.error('Failed to force X-Plane state stream reconnect', error);
      return { success: false, error: (error as Error).message };
    }
  });

  handle('xplaneService:isStreamConnected', async () => {
    try {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().isStreamConnected();
    } catch {
      return false;
    }
  });

  // Addon Manager IPC handlers (extracted to separate module)
  registerAddonManagerIPC(() => dataManager.getXPlanePath());
  registerCompanionAppsIPC(() => mainWindow);
  registerFlightRecorderIPC({
    getAirportsInBounds: (minLat, maxLat, minLon, maxLon) =>
      dataManager.getAirportsInBounds(minLat, maxLat, minLon, maxLon),
    getAirportData: (icao) => dataManager.getAirportData(icao),
    getDataref: async (name) => {
      const { getXPlaneService } = await getXPlaneModule();
      return getXPlaneService().getDataref(name);
    },
    attachSink: (sink) => {
      void getXPlaneModule().then(({ setRecorderSink }) => setRecorderSink(sink));
    },
  });
  registerXPlaneLogIPC(() => dataManager.getXPlanePath());

  handle('taxi:writeRoute', async (_, json: string) => {
    try {
      const xplanePath = dataManager.getXPlanePath();
      if (!xplanePath) {
        return { success: false, error: 'X-Plane path not configured' };
      }

      const outputDir = path.join(xplanePath, 'Output', 'x-dispatch');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filePath = path.join(outputDir, 'route.json');
      fs.writeFileSync(filePath, json, 'utf-8');
      logger.data.info(`Taxi route written to ${filePath}`);
      return { success: true, path: filePath };
    } catch (error) {
      logger.data.error('Failed to write taxi route', error);
      return { success: false, error: (error as Error).message };
    }
  });
}

// Enable remote debugging port for chrome-devtools-mcp (dev only)
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

// Must register custom scheme before app is ready
registerTileCacheScheme();

// Deep links: xdispatch://airport/ICAO, xdispatch://route?from=…, see lib/nativeShell/appUrl.
const PROTOCOL = APP_URL_SCHEME;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1]!)]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function focusMainWindow(): void {
  // `if (mainWindow)` alone passes a destroyed BrowserWindow (still truthy),
  // and any method on it throws "Object has been destroyed". Sentry
  // X-DISPATCH-6.
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function dispatchAppAction(action: AppAction): void {
  focusMainWindow();
  if (pendingAppActions.isReady() && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:action', action);
    return;
  }
  pendingAppActions.push(action);
}

function handleAppUrl(url: string): void {
  const action = parseAppUrl(url);
  if (!action) {
    logger.main.warn(`Ignoring app URL that does not parse: ${url.slice(0, 200)}`);
    return;
  }
  logger.main.info(`App URL: ${action.kind}${action.source ? ` from ${action.source}` : ''}`);
  dispatchAppAction(action);
}

/** A .fms the OS handed us: double-click, Open With, drop on the dock icon. */
function handleFilePath(filePath: string): void {
  if (!isFmsFileArg(filePath) || !fs.existsSync(filePath)) {
    logger.main.warn(`Ignoring file the OS asked to open: ${filePath.slice(0, 200)}`);
    return;
  }
  openableFiles.add(filePath);
  void app.whenReady().then(() => app.addRecentDocument(filePath));
  logger.main.info('Opening a flight plan file from the OS');
  dispatchAppAction({ kind: 'import-file', path: filePath });
}

function recentAirportsFile(): string {
  return path.join(app.getPath('userData'), 'recent-airports.json');
}

function loadRecentAirports(): void {
  try {
    recentAirports = parseRecentAirports(
      JSON.parse(fs.readFileSync(recentAirportsFile(), 'utf-8'))
    );
  } catch {
    recentAirports = [];
  }
}

/** Dock menu on macOS, jump list on Windows: the recent airports, in the UI language. */
function refreshRecentsMenus(): void {
  const labels = { recentAirports: nativeLabels.menu.recentAirports };
  const shown = desktopPrefs.recentAirportsMenu ? recentAirports : [];
  if (process.platform === 'darwin' && app.dock) {
    const template = buildDockMenuTemplate(shown, labels, (icao) =>
      dispatchAppAction({ kind: 'airport', icao })
    );
    app.dock.setMenu(Menu.buildFromTemplate(template));
  } else if (process.platform === 'win32' && app.isPackaged) {
    const categories = buildJumpListCategories(shown, labels, process.execPath);
    const result = app.setJumpList(categories.length > 0 ? categories : null);
    if (result !== 'ok') logger.main.warn(`Jump list not set: ${result}`);
  }
}

function recordRecentAirport(icao: string, name: string): void {
  recentAirports = addRecentAirport(recentAirports, { icao, name });
  try {
    fs.writeFileSync(recentAirportsFile(), JSON.stringify(recentAirports));
  } catch (err) {
    logger.main.warn('Could not save recent airports', err);
  }
  refreshRecentsMenus();
}

/**
 * Something finished while the window was in the background: bounce the Dock
 * icon on macOS, flash the taskbar elsewhere. The flash clears on focus.
 */
function requestAttention(): void {
  if (!desktopPrefs.attention) return;
  const win = mainWindow;
  if (!win || win.isDestroyed() || win.isFocused()) return;
  if (process.platform === 'darwin') {
    app.dock?.bounce('informational');
  } else {
    win.flashFrame(true);
  }
}

/** Per-user "Open With" entry for .fms; the exe path moves with every Squirrel update. */
function registerWindowsFileAssociations(): void {
  for (const args of windowsFmsRegistryCommands(process.execPath)) {
    execFile('reg', ['add', ...args], { windowsHide: true }, (err) => {
      if (err) logger.main.warn(`reg add ${args[0]} failed: ${err.message}`);
    });
  }
}

// Prevent multiple instances — focus existing window if second instance launches
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', (_event, commandLine) => {
  focusMainWindow();
  // Windows/Linux: the link or file the second instance was launched with
  const url = findAppUrlInArgv(commandLine);
  if (url) handleAppUrl(url);
  const file = findFmsFileInArgv(commandLine);
  if (file) handleFilePath(file);
});

// macOS: deep link via open-url event, which can fire before the app is ready
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAppUrl(url);
});

// macOS: a .fms opened from Finder or dropped on the dock icon
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  handleFilePath(filePath);
});

// Windows/Linux cold start: the link or file is an argument of this very process
{
  const coldStartUrl = findAppUrlInArgv(process.argv);
  if (coldStartUrl) handleAppUrl(coldStartUrl);
  const coldStartFile = findFmsFileInArgv(process.argv);
  if (coldStartFile) handleFilePath(coldStartFile);
}

/** One snapshot per launch of the window size and display scaling, as buckets. */
function reportDisplay(win: BrowserWindow): void {
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    analytics.track('display', {
      window_width: widthBucket(bounds.width),
      scale: scaleBucket(screen.getDisplayMatching(bounds).scaleFactor),
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen(),
    });
  });
}

if (!squirrelHookRun) app.whenReady().then(bootstrap);

async function bootstrap(): Promise<void> {
  // Environment snapshot for production support
  logStartupEnvironment(shouldInitSentry);
  analytics.startSession();

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

  // One dark theme: native menus, dialogs and scrollbars match it on every OS setting.
  nativeTheme.themeSource = 'dark';
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    website: PROJECT_WEBSITE,
  });
  installAppMenu();
  loadRecentAirports();
  refreshRecentsMenus();
  if (process.platform === 'win32' && app.isPackaged) registerWindowsFileAssociations();

  try {
    await initDb();
  } catch (err) {
    logger.main.error('Database init failed, deleting and retrying:', err);
    const dbFile = getDbPath();
    try {
      if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    } catch {
      try {
        fs.renameSync(dbFile, `${dbFile}.old-${Date.now()}`);
      } catch {
        /* will retry next launch */
      }
    }
    try {
      if (fs.existsSync(dbFile + '.version')) fs.unlinkSync(dbFile + '.version');
    } catch {
      /* non-critical */
    }
    try {
      await initDb();
    } catch (retryErr) {
      logger.main.error('Database init failed on retry:', retryErr);
      dialog.showErrorBox(
        'X-Dispatch — Fatal Error',
        'Failed to initialize the database. Please restart the app or reinstall.\n\n' +
          String(retryErr)
      );
      app.quit();
      return;
    }
  }

  dataManager = getXPlaneDataManager();

  if (getCliFlags().resetCache) {
    try {
      logger.main.info('CLI --reset-cache: clearing cached data before init');
      dataManager.clearCache();
    } catch (err) {
      logger.main.error('Failed to clear cache from --reset-cache; continuing boot', err);
    }
  }

  if (isSetupComplete()) {
    const xplanePath = dataManager.getXPlanePath();
    logger.main.info(`X-Plane: ${xplanePath}`);
    dataManager.initFromCache();
    const sources = dataManager.getDataSources();
    if (sources?.global) {
      logger.main.info(
        `Nav Data: ${sources.global.source}${sources.global.cycle ? ` (AIRAC ${sources.global.cycle})` : ''}`
      );
    }
  } else {
    logger.main.info('X-Plane: Not configured (first run)');
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['clipboard-read', 'clipboard-write'].includes(permission));
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });

  initTileCache();
  registerTileCacheHandler();

  registerIpcHandlers();
  initRemoteAccess({
    rendererDir: path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`),
    devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL || undefined,
    fetchTile: fetchCachedTile,
    onClientDisconnected: (clientId) => {
      void getXPlaneModule().then(({ getXPlaneService }) =>
        getXPlaneService().unsubscribe(clientId)
      );
    },
    analytics: {
      track: (event, props) => analytics.track(event, props),
      recordTabletClients: (count) => analytics.recordTabletClients(count),
    },
  });
  mainWindow = createWindow();
  reportDisplay(mainWindow);

  // Dev builds stay off the download host so HMR restarts do not hammer it.
  if (app.isPackaged) {
    setTimeout(() => {
      void refreshLatestVersion();
      if (updateStatus.get().managed) initAutoUpdater();
    }, UPDATE_FIRST_CHECK_DELAY_MS);
  }

  if (process.platform === 'darwin' && app.dock) {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.png')
      : path.join(__dirname, '..', '..', 'assets', 'icon.png');
    app.dock.setIcon(iconPath);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    dataManager?.close();
    app.quit();
  }
  // On macOS, keep DB open since app stays running
});

app.on('before-quit', () => {
  isQuitting = true;
  // Synchronous: stores the session length for the next launch and never delays quitting.
  analytics.endSession();
  void stopRemoteAccess();

  // Session summary
  const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000 / 60);
  logger.main.info('════════════════════════════════════════════════════════════════');
  logger.main.info(`Session ended - Duration: ${sessionDuration} minutes`);
  logger.main.info('════════════════════════════════════════════════════════════════');

  // Close DB and tile cache when app is actually quitting (handles macOS Cmd+Q)
  closeTileCache();
  dataManager?.close();
});

app.on('activate', () => {
  // macOS can fire 'activate' (dock click) before whenReady resolves —
  // createWindow() touches `screen` via electron-window-state, which throws
  // until app is ready. Sentry X-DISPATCH-M.
  if (!app.isReady()) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.show();
    return;
  }
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
});
