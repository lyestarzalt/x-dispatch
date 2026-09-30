import { describe, expect, it } from 'vitest';
import { type TaxiRouteSnapshot, builtTaxiRoute, isNewStartPosition } from './mapActions';

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
