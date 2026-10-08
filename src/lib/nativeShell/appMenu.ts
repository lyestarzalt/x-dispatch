import type { MenuItemConstructorOptions } from 'electron';
import { DISCORD_INVITE, PROJECT_WEBSITE } from '@/config/links';
import type { NativeLabels } from './labels';

export interface AppMenuActions {
  openSettings: () => void;
  checkForUpdates: () => void;
  openExternal: (url: string) => void;
  toggleDevTools: () => void;
}

interface AppMenuOptions {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  appName: string;
  labels: NativeLabels['menu'];
  actions: AppMenuActions;
}

/**
 * The native menu. With the title bar hidden it is only visible on macOS, but
 * its accelerators work everywhere. Page zoom roles are left out on purpose:
 * the Interface Zoom setting owns zoom and main swallows the zoom keys.
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
    label: labels.settings,
    accelerator: 'CmdOrCtrl+,',
    click: () => actions.openSettings(),
  };

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
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
      // macOS keeps Settings in the app menu; elsewhere Edit is the conventional home.
      ...(isMac ? [] : [{ type: 'separator' } as const, settings]),
    ],
  });

  template.push({ label: labels.window, role: 'windowMenu' });

  if (!isPackaged) {
    template.push({
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
    label: labels.help,
    role: 'help',
    submenu: [
      { label: labels.website, click: () => actions.openExternal(PROJECT_WEBSITE) },
      { label: labels.discord, click: () => actions.openExternal(DISCORD_INVITE) },
      { type: 'separator' },
      { label: labels.checkForUpdates, click: () => actions.checkForUpdates() },
    ],
  });

  return template;
}
