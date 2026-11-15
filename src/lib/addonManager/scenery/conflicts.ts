/**
 * Packs that fight over the same ground. Two packs declaring the same airport is
 * the usual cause of "my airport looks wrong": X-Plane takes the first enabled
 * one in scenery_packs.ini and ignores the rest. Two mesh packs on the same tile
 * are the same story for terrain.
 */
import { type SceneryEntry, SceneryPriority } from '../core/types';

export interface DuplicateAirport {
  icao: string;
  /** The pack X-Plane uses: the first enabled one in file order, or null when all are off. */
  winner: string | null;
  /** The other packs that declare this airport. */
  others: string[];
}

export interface DuplicateTile {
  /** The tile name without extension, as in the DSF file name: `+47+008`. */
  tile: string;
  others: string[];
}

export interface SceneryConflicts {
  duplicateAirports: DuplicateAirport[];
  duplicateTiles: DuplicateTile[];
}

/** DSF tile file name: one degree of latitude and longitude, signed and zero-padded. */
const TILE_FILE = /^([+-]\d{2}[+-]\d{3})\.dsf$/i;

/** Packs built to sit on top of another mesh on purpose. */
const OVERLAP_BY_DESIGN = /^XPME_/i;

const MESH_TIERS = new Set([SceneryPriority.Mesh, SceneryPriority.AirportMesh]);

/**
 * Conflicts per pack folder, from entries in scenery_packs.ini order. A pack
 * without conflicts has no entry in the result.
 */
export function findSceneryConflicts(entries: SceneryEntry[]): Map<string, SceneryConflicts> {
  const result = new Map<string, SceneryConflicts>();
  const conflictsOf = (folderName: string): SceneryConflicts => {
    let found = result.get(folderName);
    if (!found) {
      found = { duplicateAirports: [], duplicateTiles: [] };
      result.set(folderName, found);
    }
    return found;
  };

  // Airports: the same identifier declared by more than one pack.
  const packsByIcao = new Map<string, SceneryEntry[]>();
  for (const entry of entries) {
    if (entry.isGlobalAirports) continue;
    for (const icao of entry.classification.airportIcaos ?? []) {
      const list = packsByIcao.get(icao) ?? [];
      list.push(entry);
      packsByIcao.set(icao, list);
    }
  }
  for (const [icao, packs] of packsByIcao) {
    if (packs.length < 2) continue;
    const winner = packs.find((pack) => pack.enabled)?.folderName ?? null;
    for (const pack of packs) {
      conflictsOf(pack.folderName).duplicateAirports.push({
        icao,
        winner,
        others: packs.filter((other) => other !== pack).map((other) => other.folderName),
      });
    }
  }

  // Tiles: the same mesh tile shipped by more than one mesh pack.
  const packsByTile = new Map<string, SceneryEntry[]>();
  for (const entry of entries) {
    if (!MESH_TIERS.has(entry.priority) || OVERLAP_BY_DESIGN.test(entry.folderName)) continue;
    const seen = new Set<string>();
    for (const name of entry.classification.dsfFilenames) {
      const match = TILE_FILE.exec(name);
      if (!match?.[1]) continue;
      const tile = match[1];
      if (seen.has(tile)) continue;
      seen.add(tile);
      const list = packsByTile.get(tile) ?? [];
      list.push(entry);
      packsByTile.set(tile, list);
    }
  }
  for (const [tile, packs] of packsByTile) {
    if (packs.length < 2) continue;
    for (const pack of packs) {
      conflictsOf(pack.folderName).duplicateTiles.push({
        tile,
        others: packs.filter((other) => other !== pack).map((other) => other.folderName),
      });
    }
  }

  return result;
}

/** The pack X-Plane uses for an airport, and how many packs declare it. */
export function packForAirport(
  entries: SceneryEntry[],
  icao: string
): { winner: string | null; count: number } | null {
  const wanted = icao.toUpperCase();
  const packs = entries.filter(
    (entry) => !entry.isGlobalAirports && entry.classification.airportIcaos?.includes(wanted)
  );
  if (packs.length === 0) return null;
  return { winner: packs.find((pack) => pack.enabled)?.folderName ?? null, count: packs.length };
}
