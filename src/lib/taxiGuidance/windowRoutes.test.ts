import { describe, expect, it } from 'vitest';
import { leg, makeRoute } from './__fixtures__/routes';
import { NO_GUIDANCE_ROUTES, parseGuidanceRoutes } from './windowRoutes';

const departure = makeRoute(
  [
    [0, 0],
    [0, 200],
  ],
  [leg('A')],
  { runway: '27', gateName: 'G1' }
);
const arrival = makeRoute(
  [
    [0, 0],
    [100, 0],
  ],
  [leg('B')],
  { direction: 'arrival' }
);

describe('parseGuidanceRoutes', () => {
  it('keeps whole routes', () => {
    expect(parseGuidanceRoutes({ departure, arrival })).toEqual({ departure, arrival });
  });

  it('drops a route with no known source', () => {
    expect(
      parseGuidanceRoutes({ departure: { ...departure, source: 'atc' }, arrival }).departure
    ).toBeNull();
  });

  it('drops a route filed under the wrong direction', () => {
    expect(parseGuidanceRoutes({ departure: arrival, arrival: null })).toEqual(NO_GUIDANCE_ROUTES);
  });

  it('drops a route whose legs do not join its points', () => {
    const broken = { ...departure, legs: [] };
    expect(parseGuidanceRoutes({ departure: broken, arrival }).departure).toBeNull();
  });

  it('drops a route with a point that is not a position', () => {
    const broken = { ...departure, points: [{ lat: 1, lon: Number.NaN }, departure.points[1]] };
    expect(parseGuidanceRoutes({ departure: broken, arrival }).departure).toBeNull();
  });

  it('has no routes for anything else', () => {
    expect(parseGuidanceRoutes(null)).toEqual(NO_GUIDANCE_ROUTES);
    expect(parseGuidanceRoutes('routes')).toEqual(NO_GUIDANCE_ROUTES);
  });
});
