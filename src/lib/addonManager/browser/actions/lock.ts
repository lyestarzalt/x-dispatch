import * as fs from 'fs';
import * as path from 'path';

interface LockedItems {
  aircraft: string[];
  plugins: string[];
  autoLocked: string[]; // Keys in format "aircraft:foldername" or "plugins:foldername"
}

const LOCK_FILE = 'addon_locks.json';

/**
 * Get lock file path in app data directory.
 */
function getLockFilePath(appDataPath: string): string {
  return path.join(appDataPath, LOCK_FILE);
}

/**
 * Load locked items from disk.
 */
export function loadLockedItems(appDataPath: string): LockedItems {
  const lockFile = getLockFilePath(appDataPath);

  if (!fs.existsSync(lockFile)) {
    return { aircraft: [], plugins: [], autoLocked: [] };
  }

  try {
    const content = fs.readFileSync(lockFile, 'utf-8');
    const data = JSON.parse(content) as Record<string, unknown>;
    return {
      aircraft: Array.isArray(data.aircraft) ? data.aircraft : [],
      plugins: Array.isArray(data.plugins) ? data.plugins : [],
      autoLocked: Array.isArray(data.autoLocked) ? data.autoLocked : [],
    };
  } catch {
    return { aircraft: [], plugins: [], autoLocked: [] };
  }
}

/**
 * Save locked items to disk.
 */
function saveLockedItems(appDataPath: string, items: LockedItems): void {
  const lockFile = getLockFilePath(appDataPath);
  try {
    fs.writeFileSync(lockFile, JSON.stringify(items, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

/**
 * Check if an item is locked.
 */
export function isLocked(
  appDataPath: string,
  type: 'aircraft' | 'plugins',
  folderName: string
): boolean {
  const items = loadLockedItems(appDataPath);
  const lower = folderName.toLowerCase();
  return items[type].some((name) => name.toLowerCase() === lower);
}

/**
 * Toggle lock state for an item (manual lock/unlock).
 * Returns new locked state.
 */
export function toggleLock(
  appDataPath: string,
  type: 'aircraft' | 'plugins',
  folderName: string
): boolean {
  const items = loadLockedItems(appDataPath);
  const lower = folderName.toLowerCase();
  const index = items[type].findIndex((name) => name.toLowerCase() === lower);
  const autoKey = `${type}:${lower}`;

  if (index >= 0) {
    // Unlock - also remove from autoLocked if present
    items[type].splice(index, 1);
    const autoIndex = items.autoLocked.indexOf(autoKey);
    if (autoIndex >= 0) {
      items.autoLocked.splice(autoIndex, 1);
    }
    saveLockedItems(appDataPath, items);
    return false;
  } else {
    // Lock (manual lock, not auto-locked)
    items[type].push(folderName);
    saveLockedItems(appDataPath, items);
    return true;
  }
}

/**
 * Auto-lock an item when disabled.
 * Only locks if not already locked.
 */
export function autoLockOnDisable(
  appDataPath: string,
  type: 'aircraft' | 'plugins',
  folderName: string
): void {
  const items = loadLockedItems(appDataPath);
  const lower = folderName.toLowerCase();
  const autoKey = `${type}:${lower}`;

  // Only auto-lock if not already locked
  if (!items[type].some((name) => name.toLowerCase() === lower)) {
    items[type].push(folderName);
    items.autoLocked.push(autoKey);
    saveLockedItems(appDataPath, items);
  }
}

/**
 * Auto-unlock an item when enabled.
 * Only unlocks if it was auto-locked (not manually locked).
 */
export function autoUnlockOnEnable(
  appDataPath: string,
  type: 'aircraft' | 'plugins',
  folderName: string
): void {
  const items = loadLockedItems(appDataPath);
  const lower = folderName.toLowerCase();
  const autoKey = `${type}:${lower}`;

  // Only unlock if it was auto-locked
  const autoIndex = items.autoLocked.indexOf(autoKey);
  if (autoIndex >= 0) {
    // Remove from autoLocked
    items.autoLocked.splice(autoIndex, 1);

    // Remove from locked list
    const lockIndex = items[type].findIndex((name) => name.toLowerCase() === lower);
    if (lockIndex >= 0) {
      items[type].splice(lockIndex, 1);
    }

    saveLockedItems(appDataPath, items);
  }
  // If manually locked, stay locked
}

/**
 * Apply lock state to scanned items.
 */
export function applyLockState<T extends { folderName: string; locked: boolean }>(
  appDataPath: string,
  type: 'aircraft' | 'plugins',
  items: T[]
): T[] {
  const lockedItems = loadLockedItems(appDataPath);
  const lockedSet = new Set(lockedItems[type].map((n) => n.toLowerCase()));

  return items.map((item) => ({
    ...item,
    locked: lockedSet.has(item.folderName.toLowerCase()),
  }));
}
