import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { type AppMenuActions, assignMenuIds, buildAppMenuTemplate } from './appMenu';
import { DEFAULT_NATIVE_LABELS } from './labels';

function actions(): AppMenuActions {
  return {
    openSettings: vi.fn(),
    checkForUpdates: vi.fn(),
    openExternal: vi.fn(),
    toggleDevTools: vi.fn(),
    command: vi.fn(),
  };
}

function submenuOf(item: MenuItemConstructorOptions): MenuItemConstructorOptions[] {
  return item.submenu as MenuItemConstructorOptions[];
}

function findByLabel(items: MenuItemConstructorOptions[], label: string) {
  return items.find((i) => i.label === label);
}

function flatten(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return items.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? flatten(i.submenu) : [])]);
}

const labels = DEFAULT_NATIVE_LABELS.menu;
const base = { appName: 'X-Dispatch', labels, isPackaged: true };

describe('buildAppMenuTemplate', () => {
  it('starts with the app menu on macOS, holding About, Settings and the standard roles', () => {
    const template = buildAppMenuTemplate({ ...base, platform: 'darwin', actions: actions() });
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

  it('has File, Edit, View, Window and Help everywhere, Settings and Quit under File off macOS', () => {
    const template = buildAppMenuTemplate({ ...base, platform: 'win32', actions: actions() });
    expect(template.map((m) => m.label)).toEqual([
      labels.file,
      labels.edit,
      labels.view,
      labels.window,
      labels.help,
    ]);
    const file = submenuOf(template[0]!);
    expect(findByLabel(file, labels.settings)?.accelerator).toBe('CmdOrCtrl+,');
    expect(file.at(-1)!.role).toBe('quit');
  });

  it('routes File, View and Help actions to renderer commands with their accelerators', () => {
    const a = actions();
    const template = buildAppMenuTemplate({ ...base, platform: 'darwin', actions: a });
    const expectations: [string, string, string | undefined][] = [
      [labels.openFlightPlan, 'openFlightPlan', 'CmdOrCtrl+O'],
      [labels.importSimbrief, 'importSimbrief', 'CmdOrCtrl+Shift+I'],
      [labels.launchXPlane, 'launchXPlane', 'CmdOrCtrl+L'],
      [labels.findAirport, 'focusSearch', 'CmdOrCtrl+F'],
      [labels.zoomIn, 'zoomIn', 'CmdOrCtrl+='],
      [labels.zoomOut, 'zoomOut', 'CmdOrCtrl+-'],
      [labels.zoomReset, 'zoomReset', 'CmdOrCtrl+0'],
      [labels.toggleSidebar, 'toggleSidebar', 'CmdOrCtrl+B'],
      [labels.flightStripWindow, 'flightStripWindow', 'CmdOrCtrl+Shift+S'],
      [labels.keyboardShortcuts, 'keyboardShortcuts', 'CmdOrCtrl+/'],
      [labels.openLogs, 'openLogs', undefined],
    ];
    const all = flatten(template);
    for (const [label, command, accelerator] of expectations) {
      const item = findByLabel(all, label)!;
      expect(item, label).toBeDefined();
      expect(item.accelerator).toBe(accelerator);
      (item.click as () => void)();
      expect(a.command).toHaveBeenCalledWith(command);
    }
  });

  it('builds Edit and Window from roles so copy, paste and minimize work natively', () => {
    const template = buildAppMenuTemplate({ ...base, platform: 'darwin', actions: actions() });
    const editRoles = submenuOf(findByLabel(template, labels.edit)!).map((i) => i.role);
    for (const role of ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']) {
      expect(editRoles).toContain(role);
    }
    expect(findByLabel(template, labels.window)!.role).toBe('windowMenu');
  });

  it('binds Close (Cmd+W) to the closeWindow command so dialogs close before the window', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const a = actions();
      const template = buildAppMenuTemplate({ ...base, platform, actions: a });
      const close = findByLabel(submenuOf(findByLabel(template, labels.window)!), labels.close)!;
      expect(close.accelerator).toBe('CmdOrCtrl+W');
      expect(close.role).toBeUndefined();
      (close.click as () => void)();
      expect(a.command).toHaveBeenCalledWith('closeWindow');
    }
  });

  it('uses the native full screen role, with F11 off macOS and the system key on it', () => {
    const mac = flatten(buildAppMenuTemplate({ ...base, platform: 'darwin', actions: actions() }));
    const win = flatten(buildAppMenuTemplate({ ...base, platform: 'win32', actions: actions() }));
    expect(findByLabel(mac, labels.toggleFullScreen)).toMatchObject({ role: 'togglefullscreen' });
    expect(findByLabel(mac, labels.toggleFullScreen)!.accelerator).toBeUndefined();
    expect(findByLabel(win, labels.toggleFullScreen)!.accelerator).toBe('F11');
  });

  it('never exposes page zoom roles, the Interface Zoom setting owns zoom', () => {
    const all = flatten(
      buildAppMenuTemplate({ ...base, platform: 'darwin', isPackaged: false, actions: actions() })
    );
    for (const role of ['zoomIn', 'zoomOut', 'resetZoom', 'viewMenu']) {
      expect(all.some((i) => i.role === role)).toBe(false);
    }
  });

  it('adds a DevTools menu only in development builds', () => {
    const packaged = buildAppMenuTemplate({ ...base, platform: 'darwin', actions: actions() });
    expect(packaged.some((m) => m.label === 'Developer')).toBe(false);

    const devActions = actions();
    const dev = buildAppMenuTemplate({
      ...base,
      platform: 'darwin',
      isPackaged: false,
      actions: devActions,
    });
    const toggle = submenuOf(findByLabel(dev, 'Developer')!)[0]!;
    expect(toggle.accelerator).toBeUndefined();
    (toggle.click as () => void)();
    expect(devActions.toggleDevTools).toHaveBeenCalled();
  });

  it('wires Help items to the website, Discord and the update check', () => {
    const a = actions();
    const template = buildAppMenuTemplate({ ...base, platform: 'linux', actions: a });
    const help = submenuOf(findByLabel(template, labels.help)!);
    (findByLabel(help, labels.website)!.click as () => void)();
    (findByLabel(help, labels.discord)!.click as () => void)();
    (findByLabel(help, labels.checkForUpdates)!.click as () => void)();
    expect(a.openExternal).toHaveBeenCalledTimes(2);
    expect(a.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('gives every item a unique id', () => {
    const all = flatten(buildAppMenuTemplate({ ...base, platform: 'win32', actions: actions() }));
    const ids = all.map((i) => i.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('assignMenuIds', () => {
  it('keeps explicit ids and derives the rest from the path', () => {
    const [file] = assignMenuIds([
      { id: 'file', submenu: [{ role: 'undo' }, { type: 'separator' }, { label: 'X' }] },
    ]);
    expect((file!.submenu as MenuItemConstructorOptions[]).map((i) => i.id)).toEqual([
      'file.undo-0',
      'file.separator-1',
      'file.item-2',
    ]);
  });
});
