import type { MenuItemConstructorOptions } from 'electron';
import { DISCORD_INVITE, PROJECT_WEBSITE } from '@/config/links';
import type { NativeLabels } from './labels';

/**
 * Menu items the renderer carries out. Main forwards the id to the focused
 * desktop window; the renderer maps it onto its stores.
 */
export const MENU_COMMANDS = [
  'openFlightPlan',
  'importSimbrief',
  'launchXPlane',
  'focusSearch',
  'zoomIn',
  'zoomOut',
  'zoomReset',
  'toggleSidebar',
  'flightStripWindow',
  'keyboardShortcuts',
  'closeWindow',
  'openLogs',
] as const;
export type MenuCommand = (typeof MENU_COMMANDS)[number];

export interface AppMenuActions {
  openSettings: () => void;
  checkForUpdates: () => void;
  openExternal: (url: string) => void;
  toggleDevTools: () => void;
  command: (command: MenuCommand) => void;
}

interface AppMenuOptions {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  appName: string;
  labels: NativeLabels['menu'];
  actions: AppMenuActions;
}

/**
 * The native menu. macOS shows it in the menu bar; Windows and Linux hide it
 * behind the title bar's menu button but keep every accelerator. Page zoom
 * drives the Interface Zoom setting rather than the web page zoom.
 */
export function buildAppMenuTemplate({
  platform,
  isPackaged,
  appName,
  labels,
  actions,
}: AppMenuOptions): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';
  const settings: MenuItemConstructorOptions = {
    id: 'settings',
    label: labels.settings,
    accelerator: 'CmdOrCtrl+,',
    click: () => actions.openSettings(),
  };
  const command = (
    id: MenuCommand,
    label: string,
    accelerator?: string
  ): MenuItemConstructorOptions => ({
    id,
    label,
    ...(accelerator ? { accelerator } : {}),
    click: () => actions.command(id),
  });

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      id: 'app',
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        settings,
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    id: 'file',
    label: labels.file,
    submenu: [
      command('openFlightPlan', labels.openFlightPlan, 'CmdOrCtrl+O'),
      // macOS keeps the system's recent documents list; Windows has the jump list.
      ...(isMac
        ? [
            {
              role: 'recentDocuments' as const,
              submenu: [{ role: 'clearRecentDocuments' as const }],
            },
          ]
        : []),
      command('importSimbrief', labels.importSimbrief, 'CmdOrCtrl+Shift+I'),
      { type: 'separator' },
      command('launchXPlane', labels.launchXPlane, 'CmdOrCtrl+L'),
      // Settings and Quit live in the app menu on macOS; File is their home elsewhere.
      ...(isMac ? [] : [{ type: 'separator' } as const, settings, { role: 'quit' } as const]),
    ],
  });

  template.push({
    id: 'edit',
    label: labels.edit,
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac ? [{ role: 'pasteAndMatchStyle' } as const] : []),
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' },
      command('focusSearch', labels.findAirport, 'CmdOrCtrl+F'),
    ],
  });

  template.push({
    id: 'view',
    label: labels.view,
    submenu: [
      command('zoomIn', labels.zoomIn, 'CmdOrCtrl+='),
      command('zoomOut', labels.zoomOut, 'CmdOrCtrl+-'),
      command('zoomReset', labels.zoomReset, 'CmdOrCtrl+0'),
      { type: 'separator' },
      command('toggleSidebar', labels.toggleSidebar, 'CmdOrCtrl+B'),
      command('flightStripWindow', labels.flightStripWindow, 'CmdOrCtrl+Shift+S'),
      { type: 'separator' },
      {
        id: 'toggleFullScreen',
        role: 'togglefullscreen',
        label: labels.toggleFullScreen,
        // macOS has its own Ctrl+Cmd+F; F11 is the convention elsewhere.
        ...(isMac ? {} : { accelerator: 'F11' }),
      },
    ],
  });

  template.push({
    id: 'window',
    label: labels.window,
    // The role keeps the macOS list of open windows; the items are explicit because the
    // default submenu leaves Close (Cmd+W) to a File menu on macOS, and elsewhere binds
    // Ctrl+W to closing the only window, which quits the app.
    role: 'windowMenu',
    submenu: isMac
      ? [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          // Closes the frontmost dialog first, then hides the window.
          command('closeWindow', labels.close, 'CmdOrCtrl+W'),
          { type: 'separator' },
          { role: 'front' },
        ]
      : [{ role: 'minimize' }, command('closeWindow', labels.close, 'CmdOrCtrl+W')],
  });

  if (!isPackaged) {
    template.push({
      id: 'developer',
      label: 'Developer',
      submenu: [
        // F12 and Ctrl+Shift+I are caught in before-input-event; an accelerator here would toggle twice.
        { label: 'Toggle DevTools', click: () => actions.toggleDevTools() },
        { role: 'reload' },
        { role: 'forceReload' },
      ],
    });
  }

  template.push({
    id: 'help',
    label: labels.help,
    role: 'help',
    submenu: [
      command('keyboardShortcuts', labels.keyboardShortcuts, 'CmdOrCtrl+/'),
      { type: 'separator' },
      { id: 'website', label: labels.website, click: () => actions.openExternal(PROJECT_WEBSITE) },
      { id: 'discord', label: labels.discord, click: () => actions.openExternal(DISCORD_INVITE) },
      { type: 'separator' },
      command('openLogs', labels.openLogs),
      {
        id: 'checkForUpdates',
        label: labels.checkForUpdates,
        click: () => actions.checkForUpdates(),
      },
    ],
  });

  return assignMenuIds(template);
}

/**
 * Every item gets a stable id (the in-window menu on Windows and Linux clicks
 * items by id). Explicit ids win; the rest are derived from the path.
 */
export function assignMenuIds(
  items: MenuItemConstructorOptions[],
  prefix = ''
): MenuItemConstructorOptions[] {
  return items.map((item, index) => {
    const id = item.id ?? `${prefix}${item.role ?? item.type ?? 'item'}-${index}`;
    const submenu = Array.isArray(item.submenu)
      ? assignMenuIds(item.submenu, `${id}.`)
      : item.submenu;
    return { ...item, id, ...(submenu !== undefined ? { submenu } : {}) };
  });
}
