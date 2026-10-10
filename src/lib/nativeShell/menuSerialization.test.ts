import { describe, expect, it } from 'vitest';
import {
  type AppMenuNode,
  type MenuItemLike,
  formatAccelerator,
  listShortcuts,
  serializeMenu,
} from './menuSerialization';

function item(partial: Partial<MenuItemLike> & { label: string }): MenuItemLike {
  return {
    id: partial.label.toLowerCase(),
    type: 'normal',
    enabled: true,
    visible: true,
    ...partial,
  };
}

describe('serializeMenu', () => {
  it('keeps ids, labels, accelerators and nested submenus, dropping hidden items', () => {
    const menu = {
      items: [
        item({
          label: 'File',
          type: 'submenu',
          submenu: {
            items: [
              item({ label: 'Open', accelerator: 'CmdOrCtrl+O' }),
              item({ label: 'sep', type: 'separator' }),
              item({ label: 'Hidden', visible: false }),
              item({ label: 'Off', enabled: false }),
            ],
          },
        }),
      ],
    };
    expect(serializeMenu(menu)).toEqual([
      {
        id: 'file',
        type: 'submenu',
        label: 'File',
        enabled: true,
        submenu: [
          { id: 'open', type: 'normal', label: 'Open', enabled: true, accelerator: 'CmdOrCtrl+O' },
          { id: 'sep', type: 'separator', label: 'sep', enabled: true },
          { id: 'off', type: 'normal', label: 'Off', enabled: false },
        ],
      },
    ]);
    expect(serializeMenu(null)).toEqual([]);
  });

  it('skips items without an id, which the renderer could not click', () => {
    expect(serializeMenu({ items: [item({ label: 'X', id: undefined })] })).toEqual([]);
  });
});

describe('formatAccelerator', () => {
  it('uses macOS glyphs in the system order, as one string', () => {
    expect(formatAccelerator('CmdOrCtrl+Shift+I', 'darwin')).toEqual(['⇧⌘I']);
    expect(formatAccelerator('Shift+Ctrl+Alt+Cmd+F', 'darwin')).toEqual(['⌃⌥⇧⌘F']);
    expect(formatAccelerator('CmdOrCtrl+=', 'darwin')).toEqual(['⌘=']);
    expect(formatAccelerator('Escape', 'darwin')).toEqual(['⎋']);
  });

  it('spells modifiers out elsewhere, one part per key cap', () => {
    expect(formatAccelerator('CmdOrCtrl+Shift+I', 'win32')).toEqual(['Ctrl', 'Shift', 'I']);
    expect(formatAccelerator('F11', 'linux')).toEqual(['F11']);
    expect(formatAccelerator('CmdOrCtrl+/', 'win32')).toEqual(['Ctrl', '/']);
    expect(formatAccelerator('Escape', 'win32')).toEqual(['Esc']);
  });
});

describe('listShortcuts', () => {
  it('groups shortcut items by their top-level menu and skips menus without any', () => {
    const menu: AppMenuNode[] = [
      {
        id: 'file',
        type: 'submenu',
        label: 'File',
        enabled: true,
        submenu: [
          { id: 'a', type: 'normal', label: 'Open', enabled: true, accelerator: 'CmdOrCtrl+O' },
          { id: 'b', type: 'normal', label: 'No key', enabled: true },
          {
            id: 'c',
            type: 'submenu',
            label: 'Nested',
            enabled: true,
            submenu: [{ id: 'd', type: 'normal', label: 'Deep', enabled: true, accelerator: 'F2' }],
          },
        ],
      },
      { id: 'empty', type: 'submenu', label: 'Empty', enabled: true, submenu: [] },
    ];
    expect(listShortcuts(menu)).toEqual([
      {
        group: 'File',
        items: [
          { label: 'Open', accelerator: 'CmdOrCtrl+O' },
          { label: 'Deep', accelerator: 'F2' },
        ],
      },
    ]);
  });
});
