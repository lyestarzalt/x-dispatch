/**
 * Groups of scenery packs that belong together, so a 300-pack install can be
 * switched by family rather than one row at a time. Smart groups are read off
 * the folder names; custom groups are the user's own. Pure functions, shared by
 * the renderer and the tests.
 */
import type { SceneryEntry } from '../core/types';
import { SceneryPriority } from '../core/types';

export type SmartGroupKind = 'simheaven' | 'ortho' | 'airport' | 'product';

export interface SmartGroup {
  kind: SmartGroupKind;
  /** Stable identity: `simheaven:europe`, `ortho:+47+008`, `airport:EGLL`, `product:zl17-hd`. */
  key: string;
  /** What the chip says. */
  label: string;
  members: SceneryEntry[];
}

export type CustomGroupRuleMode = 'prefix' | 'contains';

export interface CustomGroupRule {
  mode: CustomGroupRuleMode;
  pattern: string;
}

export interface CustomGroup {
  id: string;
  name: string;
  /** Packs named outright. */
  members: string[];
  /** Packs matched by name, on top of the members. */
  rule?: CustomGroupRule;
}

const AIRPORT_TIERS = new Set([SceneryPriority.Airport, SceneryPriority.AirportMesh]);

/** A one-degree tile token in a folder name: `+47+008`, `-33-071`. */
const TILE_TOKEN = /[+-]\d{2}[+-]\d{3}/;

/** Name tokens that say nothing about the product: versions, sim, tier words. */
const NOISE_TOKEN = /^(v?\d+(\.\d+)*|xp\d*|x-plane|mesh|overlay|hd|uhd|library|lib)$/;

/** Regions the older SimHeaven naming used before X-World. */
const LEGACY_REGIONS = new Set([
  'africa',
  'america',
  'americas',
  'antarctica',
  'asia',
  'australia',
  'europe',
  'oceania',
]);

function normalizeName(folderName: string): string {
  return folderName.toLowerCase().replace(/[._]+/g, '-').replace(/\s+/g, '-');
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** SimHeaven packs group by region: X-World Europe, X-World Global, legacy X-Europe. */
function detectSimHeaven(entry: SceneryEntry): Omit<SmartGroup, 'members'> | null {
  const normalized = normalizeName(entry.folderName);
  if (!normalized.includes('simheaven') && !normalized.includes('x-world')) return null;
  const xWorld = /x-?world-+([a-z][a-z0-9]*)/.exec(normalized);
  const legacy = /simheaven-+x-+([a-z][a-z0-9]*)/.exec(normalized);
  let region = xWorld?.[1] ?? legacy?.[1] ?? 'global';
  if (legacy && !xWorld && !LEGACY_REGIONS.has(region)) region = 'global';
  if (/^\d/.test(region)) region = 'global';
  return {
    kind: 'simheaven',
    key: `simheaven:${region}`,
    label: `SimHeaven ${region === 'global' ? 'Global' : titleCase(region)}`,
  };
}

/** Ortho packs group by the product name in front of their tile tokens. */
function detectOrtho(entry: SceneryEntry): Omit<SmartGroup, 'members'> | null {
  const normalized = normalizeName(entry.folderName);
  const tile = TILE_TOKEN.test(entry.folderName);
  const looksOrtho = normalized.includes('ortho') || normalized.includes('photo');
  if (!tile && !looksOrtho) return null;
  if (!looksOrtho && !tile) return null;
  const product = productKey(entry.folderName) || 'ortho';
  return { kind: 'ortho', key: `ortho:${product}`, label: `Ortho ${productLabel(product)}` };
}

/** An airport pack and the libraries or meshes named after the same ICAO. */
function detectAirport(entry: SceneryEntry): Omit<SmartGroup, 'members'> | null {
  if (!AIRPORT_TIERS.has(entry.priority)) return null;
  const icao = entry.classification.airportIcaos?.[0];
  if (!icao) return null;
  return { kind: 'airport', key: `airport:${icao}`, label: icao };
}

/** The leading name tokens, with tiles and version-like words stripped. */
function productKey(folderName: string): string {
  const tokens = folderName
    .replace(new RegExp(TILE_TOKEN.source, 'g'), ' ')
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token && !NOISE_TOKEN.test(token));
  return tokens.slice(0, 2).join('-');
}

function productLabel(key: string): string {
  return key.split('-').map(titleCase).join(' ');
}

/** Packs sharing the same leading name: a publisher's set, a mesh series. */
function detectProduct(entry: SceneryEntry): Omit<SmartGroup, 'members'> | null {
  const key = productKey(entry.folderName);
  if (!key || !key.includes('-')) return null;
  return { kind: 'product', key: `product:${key}`, label: productLabel(key) };
}

const DETECTORS = [detectSimHeaven, detectOrtho, detectAirport, detectProduct];

/**
 * Smart groups with at least two members, in the order their first member
 * appears. A pack joins the first group that claims it, in detector order.
 */
export function buildSmartGroups(entries: SceneryEntry[]): SmartGroup[] {
  const groups = new Map<string, SmartGroup>();
  const claimed = new Set<string>();
  for (const detector of DETECTORS) {
    for (const entry of entries) {
      if (entry.isGlobalAirports || claimed.has(entry.folderName)) continue;
      const found = detector(entry);
      if (!found) continue;
      const group = groups.get(found.key) ?? { ...found, members: [] };
      group.members.push(entry);
      groups.set(found.key, group);
    }
    // A group that only this detector formed claims its members before the next detector runs.
    for (const group of groups.values()) {
      if (group.members.length >= 2)
        for (const member of group.members) claimed.add(member.folderName);
    }
  }
  return [...groups.values()].filter((group) => group.members.length >= 2);
}

export function matchesCustomRule(folderName: string, rule: CustomGroupRule): boolean {
  const pattern = rule.pattern.trim().toLowerCase();
  if (!pattern) return false;
  const name = folderName.toLowerCase();
  return rule.mode === 'prefix' ? name.startsWith(pattern) : name.includes(pattern);
}

/** The packs a custom group holds right now: its members plus whatever its rule matches. */
export function customGroupMembers(group: CustomGroup, entries: SceneryEntry[]): SceneryEntry[] {
  const named = new Set(group.members);
  return entries.filter(
    (entry) =>
      !entry.isGlobalAirports &&
      (named.has(entry.folderName) ||
        (group.rule ? matchesCustomRule(entry.folderName, group.rule) : false))
  );
}

/** The tier a pack sorts and shows in: the user's choice when set, else the classifier's. */
export function effectivePriority(
  entry: SceneryEntry,
  overrides: Record<string, SceneryPriority>
): SceneryPriority {
  return overrides[entry.folderName] ?? entry.priority;
}
