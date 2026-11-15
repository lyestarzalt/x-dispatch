import { describe, expect, it } from 'vitest';
import { type SceneryEntry, SceneryPriority, createDefaultClassification } from '../core/types';
import { findSceneryConflicts, packForAirport } from './conflicts';

function pack(
  folderName: string,
  options: {
    enabled?: boolean;
    priority?: SceneryPriority;
    icaos?: string[];
    tiles?: string[];
  } = {}
): SceneryEntry {
  const classification = createDefaultClassification();
  classification.airportIcaos = options.icaos ?? [];
  classification.dsfFilenames = (options.tiles ?? []).map((tile) => `${tile}.dsf`);
  return {
    folderName,
    fullPath: `/x/Custom Scenery/${folderName}`,
    enabled: options.enabled ?? true,
    priority: options.priority ?? SceneryPriority.Airport,
    classification,
    originalIndex: 0,
  };
}

describe('findSceneryConflicts', () => {
  it('names the first enabled pack as the one X-Plane uses', () => {
    const entries = [
      pack('EGLL Old', { icaos: ['EGLL'], enabled: false }),
      pack('EGLL New', { icaos: ['EGLL', 'EGLC'] }),
      pack('London City', { icaos: ['EGLC'] }),
      pack('Alone', { icaos: ['LFPG'] }),
    ];
    const conflicts = findSceneryConflicts(entries);
    expect(conflicts.get('Alone')).toBeUndefined();
    expect(conflicts.get('EGLL Old')?.duplicateAirports).toEqual([
      { icao: 'EGLL', winner: 'EGLL New', others: ['EGLL New'] },
    ]);
    expect(conflicts.get('EGLL New')?.duplicateAirports).toEqual([
      { icao: 'EGLL', winner: 'EGLL New', others: ['EGLL Old'] },
      { icao: 'EGLC', winner: 'EGLL New', others: ['London City'] },
    ]);
  });

  it('flips the winner with the file order and reports none when all are off', () => {
    const entries = [pack('B', { icaos: ['KSEA'] }), pack('A', { icaos: ['KSEA'] })];
    expect(findSceneryConflicts(entries).get('A')?.duplicateAirports[0]?.winner).toBe('B');
    entries[0]!.enabled = false;
    entries[1]!.enabled = false;
    expect(findSceneryConflicts(entries).get('A')?.duplicateAirports[0]?.winner).toBeNull();
  });

  it('reports mesh packs on the same tile, and only mesh packs', () => {
    const entries = [
      pack('Mesh A', { priority: SceneryPriority.Mesh, tiles: ['+47+008', '+47+009'] }),
      pack('Mesh B', { priority: SceneryPriority.AirportMesh, tiles: ['+47+008'] }),
      pack('Overlay', { priority: SceneryPriority.Overlay, tiles: ['+47+008'] }),
      pack('XPME_Patch', { priority: SceneryPriority.Mesh, tiles: ['+47+008'] }),
    ];
    const conflicts = findSceneryConflicts(entries);
    expect(conflicts.get('Mesh A')?.duplicateTiles).toEqual([
      { tile: '+47+008', others: ['Mesh B'] },
    ]);
    expect(conflicts.get('Mesh B')?.duplicateTiles).toEqual([
      { tile: '+47+008', others: ['Mesh A'] },
    ]);
    expect(conflicts.get('Overlay')).toBeUndefined();
    expect(conflicts.get('XPME_Patch')).toBeUndefined();
  });

  it('ignores a global airports row and names stray tile files only once', () => {
    const entries = [
      { ...pack('*GLOBAL_AIRPORTS*', { icaos: ['EGLL'] }), isGlobalAirports: true },
      pack('Heathrow', { icaos: ['EGLL'] }),
      pack('Mesh', { priority: SceneryPriority.Mesh, tiles: ['+47+008', '+47+008'] }),
      pack('Mesh 2', { priority: SceneryPriority.Mesh, tiles: ['+47+008'] }),
    ];
    const conflicts = findSceneryConflicts(entries);
    expect(conflicts.get('Heathrow')).toBeUndefined();
    expect(conflicts.get('Mesh')?.duplicateTiles).toHaveLength(1);
  });
});

describe('packForAirport', () => {
  it('finds the winning pack and the count, case-insensitively', () => {
    const entries = [
      pack('Old', { icaos: ['EGLL'], enabled: false }),
      pack('New', { icaos: ['EGLL'] }),
    ];
    expect(packForAirport(entries, 'egll')).toEqual({ winner: 'New', count: 2 });
    expect(packForAirport(entries, 'LFPG')).toBeNull();
  });
});
