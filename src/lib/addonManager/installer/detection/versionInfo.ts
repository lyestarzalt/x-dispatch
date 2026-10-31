/**
 * What version an add-on says it is, from the files updaters leave next to it,
 * and what navdata cycle a folder holds. Read both from archives (during
 * analysis) and from the X-Plane folder (to show what an install replaces).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { NavdataInfo } from '../types';

/** Files read for an add-on's version, in order of preference. */
export const VERSION_FILES = ['skunkcrafts_updater.cfg', 'version.txt'];
export const VERSION_FILE_MAX_BYTES = 64 * 1024;
const MAX_VERSION_LENGTH = 32;

/** The version a file names, or undefined when it holds none. */
export function parseVersionFile(fileName: string, text: string): string | undefined {
  const version =
    fileName.toLowerCase() === 'skunkcrafts_updater.cfg'
      ? /^\s*version\s*\|\s*(.+?)\s*$/im.exec(text)?.[1]
      : text.split(/\r?\n/)[0]?.trim();
  return version && version.length <= MAX_VERSION_LENGTH ? version : undefined;
}

/** The cycle.json fields we show, with numbers turned into strings. */
export function parseCycleJson(text: string): NavdataInfo | null {
  try {
    const cycle = JSON.parse(text) as Record<string, unknown>;
    return {
      name: typeof cycle.name === 'string' ? cycle.name : '',
      cycle: cycle.cycle === undefined ? '' : String(cycle.cycle),
      revision: cycle.revision === undefined ? undefined : String(cycle.revision),
    };
  } catch {
    return null;
  }
}

/** The version of the add-on installed at `dir`, from its version files. */
export function readInstalledVersion(dir: string): string | undefined {
  for (const name of VERSION_FILES) {
    const file = path.join(dir, name);
    try {
      if (fs.statSync(file).size > VERSION_FILE_MAX_BYTES) continue;
      const version = parseVersionFile(name, fs.readFileSync(file, 'utf8'));
      if (version) return version;
    } catch {
      // not there
    }
  }
  return undefined;
}

/** The navdata cycle installed at `dir`, from its cycle.json (one level down for GNS430). */
export function readInstalledNavdata(dir: string): NavdataInfo | undefined {
  for (const file of [path.join(dir, 'cycle.json'), path.join(dir, 'navdata', 'cycle.json')]) {
    try {
      const info = parseCycleJson(fs.readFileSync(file, 'utf8'));
      if (info) return info;
    } catch {
      // not there
    }
  }
  return undefined;
}
