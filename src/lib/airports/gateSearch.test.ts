import { describe, expect, it } from 'vitest';
import type { StartupLocation } from '@/types/apt';
import { matchGateIndices } from './gateSearch';

function gate(name: string, extra: Partial<StartupLocation> = {}): StartupLocation {
  return {
    name,
    latitude: 0,
    longitude: 0,
    heading: 0,
    location_type: 'gate',
    airplane_types: 'ABCD',
    ...extra,
  };
}

const GATES = [
  gate('A12', { icaoWidthCode: 'E', airlines: ['DLH', 'SWR'] }),
  gate('B4', { icaoWidthCode: 'C' }),
  gate('Cargo 3', { icaoWidthCode: 'E', operationType: 'cargo' }),
];

const sizeLabel = (g: StartupLocation) => (g.icaoWidthCode === 'E' ? ['Heavy'] : ['Narrow']);

describe('matchGateIndices', () => {
  it('matches every gate for an empty or blank query', () => {
    expect(matchGateIndices(GATES, '')).toEqual([0, 1, 2]);
    expect(matchGateIndices(GATES, '   ')).toEqual([0, 1, 2]);
  });

  it('matches by name, ignoring case', () => {
    expect(matchGateIndices(GATES, 'cargo')).toEqual([2]);
    expect(matchGateIndices(GATES, 'b4')).toEqual([1]);
  });

  it('matches by the labels shown for the gate', () => {
    expect(matchGateIndices(GATES, 'heavy', sizeLabel)).toEqual([0, 2]);
    expect(matchGateIndices(GATES, 'heavy')).toEqual([]);
  });

  it('matches by airline code', () => {
    expect(matchGateIndices(GATES, 'swr')).toEqual([0]);
  });

  it('returns nothing when no gate matches', () => {
    expect(matchGateIndices(GATES, 'zzz', sizeLabel)).toEqual([]);
  });
});
