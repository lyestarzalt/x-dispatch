import { describe, expect, it } from 'vitest';
import type { Runway } from '@/types/apt';
import type { Navaid } from '@/types/navigation';
import type { MergedFreqRow } from './FrequencyRow';
import { activeRunwaysFirst, isLocalizerOnly, liveRowsFirst } from './listOrder';

function runway(a: string, b: string): Runway {
  return { ends: [{ name: a }, { name: b }] } as Runway;
}

function row(label: string, staffed: boolean): MergedFreqRow {
  return {
    id: `${label}-${staffed}`,
    label,
    badgeVariant: 'secondary',
    live: staffed
      ? { badgeLabel: label, callsign: label, controllerName: '', frequency: '118.000' }
      : undefined,
  };
}

const names = (runways: Runway[]) => runways.map((r) => `${r.ends[0].name}/${r.ends[1].name}`);
const labels = (rows: MergedFreqRow[]) => rows.map((r) => r.label);

describe('isLocalizerOnly', () => {
  it('tells a LOC record (KSAN 27) from a full ILS (GitHub #359)', () => {
    expect(isLocalizerOnly({ type: 'LOC' } as Navaid)).toBe(true);
    expect(isLocalizerOnly({ type: 'ILS' } as Navaid)).toBe(false);
  });
});

describe('activeRunwaysFirst', () => {
  const runways = [runway('09R', '27L'), runway('08L', '26R'), runway('09L', '27R')];

  it('floats runways with an active end, keeping the order within each group', () => {
    expect(names(activeRunwaysFirst(runways, new Set(['27R', '26R'])))).toEqual([
      '08L/26R',
      '09L/27R',
      '09R/27L',
    ]);
  });

  it('leaves the list alone when nothing is active', () => {
    expect(activeRunwaysFirst(runways, new Set())).toBe(runways);
  });
});

describe('liveRowsFirst', () => {
  it('floats staffed rows in flight order above the unstaffed ones', () => {
    const rows = [
      row('ATIS', false),
      row('DEL', false),
      row('GND', true),
      row('TWR', false),
      row('APP', true),
      row('CTR', true),
      row('ATIS B', true),
    ];
    expect(labels(liveRowsFirst(rows))).toEqual([
      'ATIS B',
      'GND',
      'APP',
      'CTR',
      'ATIS',
      'DEL',
      'TWR',
    ]);
  });

  it('leaves the list alone when nobody is online', () => {
    const rows = [row('ATIS', false), row('TWR', false)];
    expect(liveRowsFirst(rows)).toBe(rows);
  });
});
