import { describe, expect, it } from 'vitest';
import type { ResolvedProcedure } from '@/types/navigation';
import { groupProcedures, variantSpread } from './procedureGroups';

const star = (name: string, runway?: string, transition?: string) =>
  ({ type: 'STAR', name, runway, transition, waypoints: [] }) as unknown as ResolvedProcedure;

// KEYW: two STARs, each with six transitions into runways 09 and 27 (GitHub #402).
const TRANSITIONS = ['CYAAA', 'EBAYY', 'ENEME', 'IISLY', 'MAYKO', 'MOLIE'];
const keyw = ['FNTSY1', 'KRAKN1'].flatMap((name) =>
  ['RW09', 'RW27'].flatMap((runway) => TRANSITIONS.map((tr) => star(name, runway, tr)))
);

describe('groupProcedures', () => {
  it('counts a procedure once however many runway and transition pairs it has', () => {
    const groups = groupProcedures(keyw);
    expect(groups.map((g) => g.name)).toEqual(['FNTSY1', 'KRAKN1']);
    expect(groups[0]?.variants).toHaveLength(12);
  });
});

describe('variantSpread', () => {
  it('counts each transition and runway once', () => {
    const [fntsy] = groupProcedures(keyw);
    expect(variantSpread(fntsy!.variants)).toEqual({ transitions: 6, runways: 2 });
  });

  it('counts nothing for a side the procedure does not have', () => {
    expect(variantSpread([star('ABC1', 'RW09'), star('ABC1', 'RW27')])).toEqual({
      transitions: 0,
      runways: 2,
    });
  });
});
