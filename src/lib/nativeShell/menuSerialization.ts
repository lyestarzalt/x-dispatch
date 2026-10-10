/**
 * The native menu as plain data, so the renderer can draw it on Windows and
 * Linux (where the title bar hides the menu bar) and list its shortcuts.
 */
export interface AppMenuNode {
  id: string;
  type: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  label: string;
  accelerator?: string;
  enabled: boolean;
  checked?: boolean;
  submenu?: AppMenuNode[];
}

/** The subset of Electron's MenuItem the serialiser reads; structural so tests need no Electron. */
export interface MenuItemLike {
  id?: string;
  type: AppMenuNode['type'];
  label: string;
  accelerator?: string | null;
  enabled: boolean;
  visible: boolean;
  checked?: boolean;
  submenu?: { items: MenuItemLike[] } | null;
}

export function serializeMenu(menu: { items: MenuItemLike[] } | null): AppMenuNode[] {
  if (!menu) return [];
  const out: AppMenuNode[] = [];
  for (const item of menu.items) {
    if (!item.visible || !item.id) continue;
    const node: AppMenuNode = {
      id: item.id,
      type: item.type,
      label: item.label,
      enabled: item.enabled,
    };
    if (item.accelerator) node.accelerator = item.accelerator;
    if (item.type === 'checkbox' || item.type === 'radio') node.checked = item.checked ?? false;
    if (item.submenu) node.submenu = serializeMenu(item.submenu);
    out.push(node);
  }
  return out;
}

const MAC_MODIFIERS: Record<string, string> = {
  cmdorctrl: '⌘',
  commandorcontrol: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: '⌃',
  control: '⌃',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
};
/** macOS lists modifiers in a fixed order whatever the accelerator says. */
const MAC_ORDER = ['⌃', '⌥', '⇧', '⌘'];

const OTHER_MODIFIERS: Record<string, string> = {
  cmdorctrl: 'Ctrl',
  commandorcontrol: 'Ctrl',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  super: 'Win',
  meta: 'Win',
};

const KEY_NAMES: Record<string, { mac: string; other: string }> = {
  escape: { mac: '⎋', other: 'Esc' },
  esc: { mac: '⎋', other: 'Esc' },
  backspace: { mac: '⌫', other: 'Backspace' },
  delete: { mac: '⌦', other: 'Del' },
  return: { mac: '↩', other: 'Enter' },
  enter: { mac: '↩', other: 'Enter' },
  tab: { mac: '⇥', other: 'Tab' },
  space: { mac: 'Space', other: 'Space' },
  up: { mac: '↑', other: '↑' },
  down: { mac: '↓', other: '↓' },
  left: { mac: '←', other: '←' },
  right: { mac: '→', other: '→' },
  plus: { mac: '+', other: '+' },
};

/**
 * An Electron accelerator as the platform shows it: "⇧⌘I" on macOS,
 * "Ctrl+Shift+I" elsewhere. Returns the parts so a dialog can draw key caps.
 */
export function formatAccelerator(accelerator: string, platform: NodeJS.Platform): string[] {
  const tokens = accelerator.split('+').filter((t) => t.length > 0);
  // "CmdOrCtrl+=" splits cleanly; "CmdOrCtrl++" would not, so treat a trailing
  // empty token as the plus key.
  if (accelerator.endsWith('++')) tokens.push('+');
  const isMac = platform === 'darwin';
  const modifiers: string[] = [];
  const keys: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    const modifier = (isMac ? MAC_MODIFIERS : OTHER_MODIFIERS)[lower];
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier);
      continue;
    }
    const named = KEY_NAMES[lower];
    if (named) keys.push(isMac ? named.mac : named.other);
    else keys.push(token.length === 1 ? token.toUpperCase() : token);
  }
  if (isMac) {
    modifiers.sort((a, b) => MAC_ORDER.indexOf(a) - MAC_ORDER.indexOf(b));
    return [modifiers.join('') + keys.join('')];
  }
  return [...modifiers, ...keys];
}

/** Every item with a shortcut, grouped by its top-level menu. */
export function listShortcuts(
  menu: AppMenuNode[]
): { group: string; items: { label: string; accelerator: string }[] }[] {
  const groups: { group: string; items: { label: string; accelerator: string }[] }[] = [];
  for (const top of menu) {
    const items: { label: string; accelerator: string }[] = [];
    const walk = (nodes: AppMenuNode[] | undefined) => {
      for (const node of nodes ?? []) {
        if (node.accelerator && node.type !== 'separator') {
          items.push({ label: node.label, accelerator: node.accelerator });
        }
        walk(node.submenu);
      }
    };
    walk(top.submenu);
    if (items.length > 0) groups.push({ group: top.label, items });
  }
  return groups;
}
