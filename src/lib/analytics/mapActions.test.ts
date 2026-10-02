import { describe, expect, it } from 'vitest';
import {
  type PlanProcedureSnapshot,
  type TaxiRouteSnapshot,
  builtTaxiRoute,
  isNewStartPosition,
  pickedProcedures,
} from './mapActions';

const gate = { airport: 'EGLL', type: 'ramp' as const, latitude: 51.47, longitude: -0.45 };
const emptyRoute: TaxiRouteSnapshot = {
  mode: 'network',
  networkNodeIds: [],
  waypoints: [],
  autoRouteResult: null,
};

describe('isNewStartPosition', () => {
  it('counts a first pick and a different gate', () => {
    expect(isNewStartPosition(gate, null)).toBe(true);
    expect(isNewStartPosition({ ...gate, latitude: 51.48 }, gate)).toBe(true);
  });

  it('ignores edits to the same start and clearing it', () => {
    expect(isNewStartPosition({ ...gate }, gate)).toBe(false);
    expect(isNewStartPosition(null, gate)).toBe(false);
  });
});

describe('builtTaxiRoute', () => {
  it('reports an auto route once it is found', () => {
    expect(
      builtTaxiRoute({ ...emptyRoute, networkNodeIds: [1, 2, 3], autoRouteResult: {} }, emptyRoute)
    ).toBe('auto');
  });

  it('reports clicked and drawn routes when they reach two points', () => {
    const one = { ...emptyRoute, networkNodeIds: [1] };
    expect(builtTaxiRoute({ ...emptyRoute, networkNodeIds: [1, 2] }, one)).toBe('click');
    const drawn = { ...emptyRoute, mode: 'freehand' as const };
    expect(builtTaxiRoute({ ...drawn, waypoints: [{}, {}] }, { ...drawn, waypoints: [{}] })).toBe(
      'freehand'
    );
  });

  it('stays quiet while a built route keeps growing', () => {
    const built = { ...emptyRoute, networkNodeIds: [1, 2] };
    expect(builtTaxiRoute({ ...built, networkNodeIds: [1, 2, 3] }, built)).toBeNull();
    expect(builtTaxiRoute({ ...emptyRoute, networkNodeIds: [1] }, emptyRoute)).toBeNull();
  });
});

describe('pickedProcedures', () => {
  const sid = { name: 'ABC1A' };
  const star = { name: 'XYZ2B' };
  const none: PlanProcedureSnapshot = { departure: {}, arrival: {}, autoRouting: false };

  it('reports each newly chosen procedure as a manual pick', () => {
    const next = { departure: { sid }, arrival: { star }, autoRouting: false };
    expect(pickedProcedures(next, none)).toEqual([
      { type: 'sid', source: 'manual' },
      { type: 'star', source: 'manual' },
    ]);
  });

  it('marks picks made while auto-routing as automatic', () => {
    const next = { departure: { sid }, arrival: {}, autoRouting: true };
    expect(pickedProcedures(next, none)).toEqual([{ type: 'sid', source: 'auto' }]);
  });

  it('ignores unchanged choices, clears and missing endpoints', () => {
    const chosen = { departure: { sid }, arrival: { approach: star }, autoRouting: false };
    expect(pickedProcedures(chosen, chosen)).toEqual([]);
    expect(pickedProcedures(none, chosen)).toEqual([]);
    expect(pickedProcedures({ departure: null, arrival: null, autoRouting: false }, none)).toEqual(
      []
    );
  });
});
