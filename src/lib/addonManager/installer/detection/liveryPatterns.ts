/**
 * Livery detection.
 *
 * A livery archive carries none of the markers the other addon types use: no
 * .acf, no .dsf, no library.txt. It is recognized by the texture and object
 * files a given aircraft expects, which is what the pattern dataset describes.
 *
 * The dataset in ./data/liveryPatterns.json comes from XFast-Manager
 * (https://github.com/CCA3370/XFast-Manager), GPL-3.0.
 */
import * as path from 'path';
import type { ArchiveEntry } from '../types';
import patternData from './data/liveryPatterns.json';

export interface LiveryDetectionRule {
  pattern_type: 'path' | 'file';
  pattern: string;
}

export interface LiveryPattern {
  aircraft_type_id: string;
  aircraft_name: string;
  detection_rules: LiveryDetectionRule[];
  acf_identifiers: string[];
}

export interface LiveryMatch {
  /** Folder inside the archive holding the livery, with a trailing slash */
  internalRoot: string;
  aircraftTypeId: string;
  aircraftName: string;
}

const patterns = patternData.patterns as LiveryPattern[];

export function getLiveryPatterns(): LiveryPattern[] {
  return patterns;
}

/**
 * Translate a `*` / `?` pattern into an anchored, case-insensitive regex.
 */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${body}$`, 'i');
}

const globCache = new Map<string, RegExp>();

function glob(pattern: string): RegExp {
  let regex = globCache.get(pattern);
  if (!regex) {
    regex = globToRegExp(pattern);
    globCache.set(pattern, regex);
  }
  return regex;
}

/**
 * Match an .acf file name against the identifiers a pattern lists.
 * Identifiers are written against the file name without its extension.
 */
export function matchesAcfIdentifier(acfFileName: string, identifiers: string[]): boolean {
  const stem = path.basename(acfFileName, path.extname(acfFileName));
  return identifiers.some((identifier) => glob(identifier).test(stem));
}

/**
 * Longest suffix of `entryPath` that a rule can match against, i.e. the path
 * relative to a candidate livery root.
 *
 * `objects/fuselage320*.png` has to match `Delta A320/objects/fuselage320.png`
 * and yield `Delta A320/` as the root.
 */
function matchRule(entryPath: string, rule: LiveryDetectionRule): string | null {
  const normalized = entryPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const ruleDepth = rule.pattern.split('/').length;

  if (segments.length < ruleDepth) return null;

  const tail = segments.slice(segments.length - ruleDepth).join('/');
  const head = segments.slice(0, segments.length - ruleDepth).join('/');

  if (rule.pattern_type === 'path') {
    if (!normalized.toLowerCase().includes(rule.pattern.toLowerCase())) return null;
    // A path rule names a folder, so the root is whatever precedes it.
    const index = normalized.toLowerCase().indexOf(rule.pattern.toLowerCase());
    const prefix = normalized.slice(0, index);
    return prefix.endsWith('/') || prefix === '' ? prefix : null;
  }

  if (!glob(rule.pattern).test(tail)) return null;
  return head === '' ? '' : `${head}/`;
}

/**
 * Find the liveries in an archive listing.
 * One archive can hold several liveries for the same aircraft, each in its own
 * folder, so matches are grouped by root.
 */
export function detectLiveries(entries: ArchiveEntry[]): LiveryMatch[] {
  const byRoot = new Map<string, LiveryMatch>();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    for (const pattern of patterns) {
      for (const rule of pattern.detection_rules) {
        const root = matchRule(entry.path, rule);
        if (root === null) continue;
        if (byRoot.has(root)) break;
        byRoot.set(root, {
          internalRoot: root,
          aircraftTypeId: pattern.aircraft_type_id,
          aircraftName: pattern.aircraft_name,
        });
        break;
      }
    }
  }

  // Drop a livery nested inside another one (a pack wrapped in an outer folder
  // whose own textures also matched).
  const roots = [...byRoot.keys()].sort((a, b) => a.length - b.length);
  const kept: LiveryMatch[] = [];
  for (const root of roots) {
    if (root !== '' && kept.some((m) => m.internalRoot !== '' && root.startsWith(m.internalRoot))) {
      continue;
    }
    const match = byRoot.get(root);
    if (match) kept.push(match);
  }

  return kept;
}

const TEXTURE_EXTENSIONS = new Set(['.png', '.dds', '.obj', '.dae', '.cfg', '.txt']);

/**
 * Fallback for a livery whose aircraft is not in the dataset: a folder made of
 * textures and objects, with no marker file of any other addon type.
 */
export function looksLikeUnknownLivery(entries: ArchiveEntry[]): boolean {
  const files = entries.filter((e) => !e.isDirectory);
  if (files.length === 0) return false;

  let textures = 0;
  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    if (ext === '.acf' || ext === '.dsf' || ext === '.xpl' || ext === '.lua') return false;
    if (path.basename(file.path).toLowerCase() === 'library.txt') return false;
    if (TEXTURE_EXTENSIONS.has(ext)) textures++;
  }

  const hasObjectsFolder = files.some((f) => f.path.replace(/\\/g, '/').includes('objects/'));
  return hasObjectsFolder && textures / files.length > 0.5;
}
