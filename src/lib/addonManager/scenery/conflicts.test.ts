import { describe, expect, it } from 'vitest';
import {
  type SceneryClassification,
  type SceneryEntry,
  SceneryPriority,
  createDefaultClassification,
} from '../core/types';
import {
  findIcaoConflicts,
  findMissingLibraries,
  findTileOverlaps,
  libraryDownloadUrl,
  promoteAirportMeshes,
} from './conflicts';

function entry(
  sceneryPath: string,
  overrides: Partial<SceneryEntry> = {},
  classification: Partial<SceneryClassification> = {}
): SceneryEntry {
  return {
    sceneryPath,
    displayName: sceneryPath.split('/').pop() ?? sceneryPath,
    fullPath: `C:/X-Plane 12/${sceneryPath}`,
    enabled: true,
    priority: SceneryPriority.Unrecognized,
    classification: { ...createDefaultClassification(), ...classification },
    originalIndex: 0,
    ...overrides,
  };
}

function overlay(): Partial<SceneryClassification> {
  return { dsfInfo: { parsed: true, isOverlay: true, creationAgent: '', hasTerrainRefs: false } };
}

describe('tile overlaps', () => {
  it('pairs packs of the same kind that share tiles', () => {
    const overlaps = findTileOverlaps([
      entry('Custom Scenery/OrthoA', {}, { dsfFilenames: ['+50+000.dsf', '+50+001.dsf'] }),
      entry('Custom Scenery/OrthoB', {}, { dsfFilenames: ['+50+000.dsf', '+50+001.dsf'] }),
    ]);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]!.kind).toBe('mesh');
    expect(overlaps[0]!.tileCount).toBe(2);
    expect(overlaps[0]!.tiles).toEqual(['+50+000', '+50+001']);
  });

  it('lets an overlay and a mesh share the same tile', () => {
    const overlaps = findTileOverlaps([
      entry('Custom Scenery/Mesh', {}, { dsfFilenames: ['+50+000.dsf'] }),
      entry('Custom Scenery/Overlay', {}, { dsfFilenames: ['+50+000.dsf'], ...overlay() }),
    ]);

    expect(overlaps).toHaveLength(0);
  });

  it('ignores disabled and missing packs', () => {
    const overlaps = findTileOverlaps([
      entry('Custom Scenery/A', {}, { dsfFilenames: ['+50+000.dsf'] }),
      entry('Custom Scenery/B', { enabled: false }, { dsfFilenames: ['+50+000.dsf'] }),
      entry('Custom Scenery/C', { missing: true }, { dsfFilenames: ['+50+000.dsf'] }),
    ]);

    expect(overlaps).toHaveLength(0);
  });
});

describe('duplicate airports', () => {
  it('lists the packs claiming an airport, load order first', () => {
    const conflicts = findIcaoConflicts([
      entry('Custom Scenery/EGLL Pro', {}, { icaos: ['EGLL'] }),
      entry('Custom Scenery/EGLL Free', {}, { icaos: ['EGLL', 'EGLC'] }),
      entry('Custom Scenery/LFPG', {}, { icaos: ['LFPG'] }),
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.icao).toBe('EGLL');
    expect(conflicts[0]!.entries).toEqual(['Custom Scenery/EGLL Pro', 'Custom Scenery/EGLL Free']);
  });
});

describe('missing libraries', () => {
  it('reports a library nothing installed provides', () => {
    const missing = findMissingLibraries([
      entry('Custom Scenery/EGLL', {}, { libraryRefs: ['opensceneryx', 'ruscenery'] }),
      entry(
        'Custom Scenery/OpenSceneryX',
        {},
        { hasLibraryTxt: true, libraryExports: ['opensceneryx'] }
      ),
    ]);

    expect(missing).toHaveLength(1);
    expect(missing[0]!.library).toBe('ruscenery');
    expect(missing[0]!.requiredBy).toEqual(['Custom Scenery/EGLL']);
  });

  it('attaches a download link when the library is known', () => {
    const missing = findMissingLibraries([
      entry('Custom Scenery/EGLL', {}, { libraryRefs: ['opensceneryx'] }),
    ]);

    expect(missing[0]!.downloadUrl).toBeDefined();
  });

  it('ignores libraries a disabled pack asks for', () => {
    const missing = findMissingLibraries([
      entry('Custom Scenery/EGLL', { enabled: false }, { libraryRefs: ['ruscenery'] }),
    ]);

    expect(missing).toHaveLength(0);
  });

  it('knows the download page for a bundled library name', () => {
    expect(libraryDownloadUrl('OpenSceneryX')).toContain('http');
    expect(libraryDownloadUrl('not_a_real_library')).toBeUndefined();
  });
});

describe('airport mesh promotion', () => {
  it('lifts a small mesh named after an installed airport above the world mesh', () => {
    const entries = [
      entry(
        'Custom Scenery/EGLL Airport',
        { priority: SceneryPriority.Airport },
        { icaos: ['EGLL'] }
      ),
      entry(
        'Custom Scenery/EGLL_mesh',
        { priority: SceneryPriority.Mesh },
        { dsfCount: 1, dsfFilenames: ['+51-001.dsf'] }
      ),
      entry(
        'Custom Scenery/zOrtho4XP_+51-001',
        { priority: SceneryPriority.Mesh },
        { dsfCount: 400 }
      ),
    ];

    promoteAirportMeshes(entries);

    expect(entries[1]!.priority).toBe(SceneryPriority.AirportMesh);
    expect(entries[2]!.priority).toBe(SceneryPriority.Mesh);
  });

  it('leaves meshes alone when no custom airport is installed', () => {
    const entries = [
      entry('Custom Scenery/EGLL_mesh', { priority: SceneryPriority.Mesh }, { dsfCount: 1 }),
    ];

    promoteAirportMeshes(entries);

    expect(entries[0]!.priority).toBe(SceneryPriority.Mesh);
  });
});
