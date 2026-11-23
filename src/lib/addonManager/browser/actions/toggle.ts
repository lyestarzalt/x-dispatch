import * as fs from 'fs';
import * as path from 'path';
import { errorMessage } from '@/lib/utils/errors';
import type { BrowserError, Result } from '../../core/types';
import { err, ok } from '../../core/types';
import { validatePathWithin } from './pathGuard';

/**
 * Rename every pair in order; if one fails, put the ones already renamed back so
 * an add-on is never left half enabled. Throws the original error after the rollback.
 */
function renameAllOrNone(pairs: Array<[string, string]>): void {
  const done: Array<[string, string]> = [];
  try {
    for (const [from, to] of pairs) {
      fs.renameSync(from, to);
      done.push([from, to]);
    }
  } catch (e) {
    for (const [from, to] of done.reverse()) {
      try {
        fs.renameSync(to, from);
      } catch {
        // Best effort: the original error is the one worth reporting.
      }
    }
    throw e;
  }
}

/**
 * Toggle aircraft enabled state.
 * Renames .acf <-> .xfma at TOP LEVEL ONLY (not recursive).
 * Returns new enabled state.
 */
export function toggleAircraft(
  xplanePath: string,
  aircraftFolder: string
): Result<boolean, BrowserError> {
  if (!aircraftFolder || aircraftFolder.includes('..')) {
    return err({ code: 'PATH_TRAVERSAL', path: aircraftFolder });
  }

  const aircraftRoot = path.join(xplanePath, 'Aircraft');
  const folder = path.join(aircraftRoot, aircraftFolder);

  // Defense-in-depth: validate resolved path
  if (!validatePathWithin(aircraftRoot, folder)) {
    return err({ code: 'PATH_TRAVERSAL', path: aircraftFolder });
  }

  if (!fs.existsSync(folder)) {
    return err({ code: 'NOT_FOUND', path: folder });
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folder, { withFileTypes: true }).filter((e) => e.isFile());
  } catch (e) {
    const message = errorMessage(e);
    return err({ code: 'TOGGLE_FAILED', path: folder, reason: message });
  }

  const acfFiles = entries.filter((e) => path.extname(e.name).toLowerCase() === '.acf');
  const xfmaFiles = entries.filter((e) => path.extname(e.name).toLowerCase() === '.xfma');

  try {
    if (acfFiles.length > 0) {
      // Disable: rename ALL .acf to .xfma
      renameAllOrNone(
        acfFiles.map((file) => [
          path.join(folder, file.name),
          path.join(folder, file.name.replace(/\.acf$/i, '.xfma')),
        ])
      );
      return ok(false); // Now disabled
    } else if (xfmaFiles.length > 0) {
      // Enable: rename ALL .xfma to .acf
      renameAllOrNone(
        xfmaFiles.map((file) => [
          path.join(folder, file.name),
          path.join(folder, file.name.replace(/\.xfma$/i, '.acf')),
        ])
      );
      return ok(true); // Now enabled
    }
  } catch (e) {
    const message = errorMessage(e);
    return err({ code: 'TOGGLE_FAILED', path: folder, reason: message });
  }

  return err({ code: 'NOT_FOUND', path: folder });
}

/**
 * Toggle plugin enabled state.
 * Renames .xpl <-> .xfmp RECURSIVELY (max depth 10).
 */
export function togglePlugin(
  xplanePath: string,
  pluginFolder: string
): Result<boolean, BrowserError> {
  if (
    !pluginFolder ||
    pluginFolder.includes('..') ||
    pluginFolder.includes('/') ||
    pluginFolder.includes('\\')
  ) {
    return err({ code: 'PATH_TRAVERSAL', path: pluginFolder });
  }

  const pluginsRoot = path.join(xplanePath, 'Resources', 'plugins');
  const folder = path.join(pluginsRoot, pluginFolder);

  // Defense-in-depth: validate resolved path
  if (!validatePathWithin(pluginsRoot, folder)) {
    return err({ code: 'PATH_TRAVERSAL', path: pluginFolder });
  }

  if (!fs.existsSync(folder)) {
    return err({ code: 'NOT_FOUND', path: folder });
  }

  const xplFiles: string[] = [];
  const xfmpFiles: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > 10) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.xpl') xplFiles.push(fullPath);
        if (ext === '.xfmp') xfmpFiles.push(fullPath);
      }
      if (entry.isDirectory()) walk(fullPath, depth + 1);
    }
  }

  walk(folder, 0);

  try {
    if (xplFiles.length > 0) {
      // Disable: rename ALL .xpl to .xfmp
      renameAllOrNone(xplFiles.map((file) => [file, file.replace(/\.xpl$/i, '.xfmp')]));
      return ok(false);
    } else if (xfmpFiles.length > 0) {
      // Enable: rename ALL .xfmp to .xpl
      renameAllOrNone(xfmpFiles.map((file) => [file, file.replace(/\.xfmp$/i, '.xpl')]));
      return ok(true);
    }
  } catch (e) {
    const message = errorMessage(e);
    return err({ code: 'TOGGLE_FAILED', path: folder, reason: message });
  }

  return err({ code: 'NOT_FOUND', path: folder });
}

/**
 * Toggle lua script enabled state.
 * Renames .lua <-> .xfml (single file).
 */
export function toggleLuaScript(
  xplanePath: string,
  fileName: string
): Result<boolean, BrowserError> {
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return err({ code: 'PATH_TRAVERSAL', path: fileName });
  }

  const scriptsDir = path.join(xplanePath, 'Resources', 'plugins', 'FlyWithLua', 'Scripts');
  const filePath = path.join(scriptsDir, fileName);

  // Defense-in-depth: validate resolved path
  if (!validatePathWithin(scriptsDir, filePath)) {
    return err({ code: 'PATH_TRAVERSAL', path: fileName });
  }

  if (!fs.existsSync(filePath)) {
    return err({ code: 'NOT_FOUND', path: filePath });
  }

  const ext = path.extname(fileName).toLowerCase();

  try {
    if (ext === '.lua') {
      const newPath = filePath.replace(/\.lua$/i, '.xfml');
      fs.renameSync(filePath, newPath);
      return ok(false); // Now disabled
    } else if (ext === '.xfml') {
      const newPath = filePath.replace(/\.xfml$/i, '.lua');
      fs.renameSync(filePath, newPath);
      return ok(true); // Now enabled
    }
  } catch (e) {
    const message = errorMessage(e);
    return err({ code: 'TOGGLE_FAILED', path: filePath, reason: message });
  }

  return err({ code: 'INVALID_INPUT', field: 'fileName' });
}
