import { describe, expect, it } from 'vitest';
import { type SceneryEntry, SceneryPriority, createDefaultClassification } from '../core/types';
import {
  buildSmartGroups,
  customGroupMembers,
  effectivePriority,
  matchesCustomRule,
} from './groups';

function pack(
  folderName: string,
  priority: SceneryPriority = SceneryPriority.Mesh,
  icaos: string[] = []
): SceneryEntry {
  const classification = createDefaultClassification();
  classification.airportIcaos = icaos;
  return {
    folderName,
    fullPath: `/x/Custom Scenery/${folderName}`,
    enabled: true,
    priority,
    classification,
    originalIndex: 0,
  };
}

describe('buildSmartGroups', () => {
  it('groups SimHeaven layers by region, old and new naming alike', () => {
    const groups = buildSmartGroups([
      pack('simHeaven_X-World_Europe-1-vfr', SceneryPriority.Overlay),
      pack('simHeaven_X-World_Europe-8-network', SceneryPriority.Overlay),
      pack('simHeaven_X-Europe-3-details', SceneryPriority.Overlay),
      pack('simHeaven_X-World_Global-forests', SceneryPriority.Overlay),
      pack('simHeaven_X-World_Global-2-buildings', SceneryPriority.Overlay),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.members.length])).toEqual([
      ['simheaven:europe', 'SimHeaven Europe', 3],
      ['simheaven:global', 'SimHeaven Global', 2],
    ]);
  });

  it('groups ortho tiles by their product name', () => {
    const groups = buildSmartGroups([
      pack('zOrtho4XP_+47+008'),
      pack('zOrtho4XP_+47+009'),
      pack('zPhotoXP_+33-118'),
      pack('yOrtho4XP_Overlays'),
    ]);
    expect(groups.map((g) => [g.kind, g.members.length])).toEqual([['ortho', 2]]);
  });

  it('groups an airport with its mesh by ICAO and leaves singles alone', () => {
    const groups = buildSmartGroups([
      pack('EGLL Heathrow', SceneryPriority.Airport, ['EGLL']),
      pack('EGLL Heathrow Mesh', SceneryPriority.AirportMesh, ['EGLL']),
      pack('LFPG Paris', SceneryPriority.Airport, ['LFPG']),
    ]);
    expect(groups.map((g) => [g.key, g.members.length])).toEqual([['airport:EGLL', 2]]);
  });

  it('groups a publisher series by its leading name and ignores version words', () => {
    const groups = buildSmartGroups([
      pack('Orbx_TrueEarth_GB_South_v1.2'),
      pack('Orbx_TrueEarth_GB_North_HD'),
      pack('Orbx_TrueEarth_GB_Central'),
      pack('Alone_Pack'),
    ]);
    expect(groups.map((g) => [g.kind, g.label, g.members.length])).toEqual([
      ['product', 'Orbx Trueearth', 3],
    ]);
  });

  it('lets a pack belong to one group only, the first detector that claims it', () => {
    const groups = buildSmartGroups([
      pack('simHeaven_X-World_Europe-1-vfr', SceneryPriority.Overlay),
      pack('simHeaven_X-World_Europe-2-regions', SceneryPriority.Overlay),
      pack('simHeaven_X-World_Global-forests', SceneryPriority.Overlay),
      pack('simHeaven_X-World_Global-2-buildings', SceneryPriority.Overlay),
    ]);
    const all = groups.flatMap((g) => g.members.map((m) => m.folderName));
    expect(new Set(all).size).toBe(all.length);
    expect(groups.every((g) => g.kind === 'simheaven')).toBe(true);
  });
});

describe('custom groups', () => {
  it('matches by prefix or contains and lists named members too', () => {
    expect(matchesCustomRule('Orbx_EGLL', { mode: 'prefix', pattern: 'orbx' })).toBe(true);
    expect(matchesCustomRule('My Orbx pack', { mode: 'prefix', pattern: 'orbx' })).toBe(false);
    expect(matchesCustomRule('My Orbx pack', { mode: 'contains', pattern: 'orbx' })).toBe(true);
    expect(matchesCustomRule('Anything', { mode: 'contains', pattern: '  ' })).toBe(false);
    const entries = [pack('Orbx_A'), pack('Other'), pack('Orbx_B')];
    const members = customGroupMembers(
      { id: '1', name: 'Mine', members: ['Other'], rule: { mode: 'prefix', pattern: 'Orbx_' } },
      entries
    );
    expect(members.map((m) => m.folderName)).toEqual(['Orbx_A', 'Other', 'Orbx_B']);
  });
});

describe('effectivePriority', () => {
  it('prefers the user tier over the detected one', () => {
    const entry = pack('Thing', SceneryPriority.Unrecognized);
    expect(effectivePriority(entry, {})).toBe(SceneryPriority.Unrecognized);
    expect(effectivePriority(entry, { Thing: SceneryPriority.Library })).toBe(
      SceneryPriority.Library
    );
  });
});
