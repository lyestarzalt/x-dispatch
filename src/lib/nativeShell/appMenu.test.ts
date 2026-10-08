import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { type AppMenuActions, buildAppMenuTemplate } from './appMenu';
import { DEFAULT_NATIVE_LABELS } from './labels';

function actions(): AppMenuActions {
  return {
    openSettings: vi.fn(),
    checkForUpdates: vi.fn(),
    openExternal: vi.fn(),
    toggleDevTools: vi.fn(),
  };
}

function submenuOf(item: MenuItemConstructorOptions): MenuItemConstructorOptions[] {
  return item.submenu as MenuItemConstructorOptions[];
}

function findByLabel(items: MenuItemConstructorOptions[], label: string) {
  return items.find((i) => i.label === label);
}

const labels = DEFAULT_NATIVE_LABELS.menu;

describe('buildAppMenuTemplate', () => {
  it('starts with the app menu on macOS, holding About, Settings and the standard roles', () => {
    const template = buildAppMenuTemplate({
      platform: 'darwin',
      isPackaged: true,
      appName: 'X-Dispatch',
      labels,
      actions: actions(),
    });
    expect(template[0]!.label).toBe('X-Dispatch');
    const roles = submenuOf(template[0]!).map((i) => i.role ?? i.label ?? i.type);
    expect(roles).toEqual([
      'about',
      'separator',
      labels.settings,
      'separator',
      'services',
      'separator',
      'hide',
      'hideOthers',
      'unhide',
      'separator',
      'quit',
    ]);
    const settings = findByLabel(submenuOf(template[0]!), labels.settings)!;
    expect(settings.accelerator).toBe('CmdOrCtrl+,');
  });

  it('has no app menu off macOS, and Settings sits in Edit there', () => {
    const template = buildAppMenuTemplate({
      platform: 'win32',
      isPackaged: true,
      appName: 'X-Dispatch',
      labels,
      actions: actions(),
    });
    expect(template.map((m) => m.label)).toEqual([labels.edit, labels.window, labels.help]);
    const edit = submenuOf(template[0]!);
    expect(findByLabel(edit, labels.settings)?.accelerator).toBe('CmdOrCtrl+,');
  });

  it('builds Edit and Window from roles so copy, paste and minimize work natively', () => {
    const template = buildAppMenuTemplate({
      platform: 'darwin',
      isPackaged: true,
      appName: 'X-Dispatch',
      labels,
      actions: actions(),
    });
    const edit = findByLabel(template, labels.edit)!;
    const editRoles = submenuOf(edit).map((i) => i.role);
    for (const role of ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']) {
      expect(editRoles).toContain(role);
    }
    expect(findByLabel(template, labels.window)!.role).toBe('windowMenu');
  });

  it('never exposes page zoom roles, the Interface Zoom setting owns zoom', () => {
    const template = buildAppMenuTemplate({
      platform: 'darwin',
      isPackaged: false,
      appName: 'X-Dispatch',
      labels,
      actions: actions(),
    });
    const all = template.flatMap((m) => [
      m,
      ...((m.submenu as MenuItemConstructorOptions[]) ?? []),
    ]);
    for (const role of ['zoomIn', 'zoomOut', 'resetZoom', 'viewMenu']) {
      expect(all.some((i) => i.role === role)).toBe(false);
    }
  });

  it('adds a DevTools menu only in development builds', () => {
    const base = { platform: 'darwin' as const, appName: 'X-Dispatch', labels };
    const packaged = buildAppMenuTemplate({ ...base, isPackaged: true, actions: actions() });
    expect(packaged.some((m) => m.label === 'Developer')).toBe(false);

    const devActions = actions();
    const dev = buildAppMenuTemplate({ ...base, isPackaged: false, actions: devActions });
    const devMenu = findByLabel(dev, 'Developer')!;
    const toggle = submenuOf(devMenu)[0]!;
    expect(toggle.accelerator).toBeUndefined();
    (toggle.click as () => void)();
    expect(devActions.toggleDevTools).toHaveBeenCalled();
  });

  it('wires Help items to the website, Discord and the update check', () => {
    const a = actions();
    const template = buildAppMenuTemplate({
      platform: 'linux',
      isPackaged: true,
      appName: 'X-Dispatch',
      labels,
      actions: a,
    });
    const help = findByLabel(template, labels.help)!;
    expect(help.role).toBe('help');
    const items = submenuOf(help);
    (findByLabel(items, labels.website)!.click as () => void)();
    (findByLabel(items, labels.discord)!.click as () => void)();
    (findByLabel(items, labels.checkForUpdates)!.click as () => void)();
    expect(a.openExternal).toHaveBeenNthCalledWith(1, 'https://x-dispatch.app/');
    expect(a.openExternal).toHaveBeenNthCalledWith(2, 'https://discord.gg/76UYpxXWW7');
    expect(a.checkForUpdates).toHaveBeenCalled();
  });

  it('opens Settings through the action', () => {
    const a = actions();
    const template = buildAppMenuTemplate({
      platform: 'darwin',
      isPackaged: true,
      appName: 'X-Dispatch',
      labels,
      actions: a,
    });
    (findByLabel(submenuOf(template[0]!), labels.settings)!.click as () => void)();
    expect(a.openSettings).toHaveBeenCalled();
  });
});
