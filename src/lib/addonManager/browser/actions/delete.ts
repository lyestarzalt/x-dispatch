import * as fs from 'fs';
import * as path from 'path';
import type { BrowserError, Result } from '../../core/types';
import { err, ok } from '../../core/types';

/**
 * Validate path is within base directory (prevent traversal).
 */
function validatePathWithin(basePath: string, targetPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  return resolvedTarget.startsWith(resolvedBase + path.sep);
}

/**
 * Delete an aircraft folder.
 */
export function deleteAircraft(
  xplanePath: string,
  aircraftFolder: string
): Result<void, BrowserError> {
  if (aircraftFolder.includes('..')) {
    return err({ code: 'PATH_TRAVERSAL', path: aircraftFolder });
  }

  const aircraftRoot = path.join(xplanePath, 'Aircraft');
  const folder = path.join(aircraftRoot, aircraftFolder);

  if (!validatePathWithin(aircraftRoot, folder)) {
    return err({ code: 'PATH_TRAVERSAL', path: aircraftFolder });
  }

  if (!fs.existsSync(folder)) {
    return err({ code: 'NOT_FOUND', path: folder });
  }

  try {
    fs.rmSync(folder, { recursive: true, force: true });
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'DELETE_FAILED', path: folder, reason: message });
  }
}

/**
 * Delete a plugin folder.
 */
export function deletePlugin(xplanePath: string, pluginFolder: string): Result<void, BrowserError> {
  if (pluginFolder.includes('..') || pluginFolder.includes('/')) {
    return err({ code: 'PATH_TRAVERSAL', path: pluginFolder });
  }

  const pluginsRoot = path.join(xplanePath, 'Resources', 'plugins');
  const folder = path.join(pluginsRoot, pluginFolder);

  if (!validatePathWithin(pluginsRoot, folder)) {
    return err({ code: 'PATH_TRAVERSAL', path: pluginFolder });
  }

  if (!fs.existsSync(folder)) {
    return err({ code: 'NOT_FOUND', path: folder });
  }

  try {
    fs.rmSync(folder, { recursive: true, force: true });
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'DELETE_FAILED', path: folder, reason: message });
  }
}

/**
 * Delete a livery folder.
 */
export function deleteLivery(
  xplanePath: string,
  aircraftFolder: string,
  liveryFolder: string
): Result<void, BrowserError> {
  if (aircraftFolder.includes('..') || liveryFolder.includes('..')) {
    return err({ code: 'PATH_TRAVERSAL', path: `${aircraftFolder}/${liveryFolder}` });
  }

  const liveriesRoot = path.join(xplanePath, 'Aircraft', aircraftFolder, 'liveries');
  const folder = path.join(liveriesRoot, liveryFolder);

  if (!validatePathWithin(liveriesRoot, folder)) {
    return err({ code: 'PATH_TRAVERSAL', path: liveryFolder });
  }

  if (!fs.existsSync(folder)) {
    return err({ code: 'NOT_FOUND', path: folder });
  }

  try {
    fs.rmSync(folder, { recursive: true, force: true });
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'DELETE_FAILED', path: folder, reason: message });
  }
}

/**
 * Delete a lua script file.
 */
export function deleteLuaScript(xplanePath: string, fileName: string): Result<void, BrowserError> {
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return err({ code: 'PATH_TRAVERSAL', path: fileName });
  }

  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.lua' && ext !== '.xfml') {
    return err({ code: 'INVALID_INPUT', field: 'fileName' });
  }

  const filePath = path.join(xplanePath, 'Resources', 'plugins', 'FlyWithLua', 'Scripts', fileName);

  if (!fs.existsSync(filePath)) {
    return err({ code: 'NOT_FOUND', path: filePath });
  }

  try {
    fs.unlinkSync(filePath);
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'DELETE_FAILED', path: filePath, reason: message });
  }
}
