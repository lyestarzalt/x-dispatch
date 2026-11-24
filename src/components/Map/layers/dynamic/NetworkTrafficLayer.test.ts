import { describe, expect, it } from 'vitest';
import type { NetworkPilot } from '@/types/networkTraffic';
import { createNetworkRouteGeoJSON } from './NetworkRouteLayer';
import { createNetworkPilotGeoJSON, networkTrafficLayerIds } from './NetworkTrafficLayer';

const pilot: NetworkPilot = {
  network: 'ivao',
  id: 9,
  callsign: 'DLH400',
  name: '',
  latitude: 50.1,
  longitude: 8.6,
  altitudeFt: 37050,
  groundspeedKts: 470,
  headingDeg: 300,
  transponder: '1000',
  onGround: false,
  flightPlan: {
    flightRules: 'IFR',
    aircraft: 'B748',
    departure: 'EDDF',
    arrival: 'KJFK',
    alternate: null,
    cruiseAltitudeFt: 37000,
    route: 'DCT',
  },
};

describe('createNetworkPilotGeoJSON', () => {
  it('labels an airborne pilot with its callsign and flight level', () => {
    const fc = createNetworkPilotGeoJSON([pilot]);
    expect(fc.features[0]?.properties).toMatchObject({
      id: 9,
      callsign: 'DLH400',
      heading: 300,
      acIcon: 'B748',
      onGround: false,
      label: 'DLH400\nFL371',
    });
  });
  it('labels a pilot on the ground with the callsign only', () => {
    const fc = createNetworkPilotGeoJSON([{ ...pilot, onGround: true, altitudeFt: 364 }]);
    expect(fc.features[0]?.properties?.label).toBe('DLH400');
  });
  it('gives an airborne pilot its altitude in metres as the drawing height', () => {
    const fc = createNetworkPilotGeoJSON([pilot]);
    expect(fc.features[0]?.properties?.heightM).toBeCloseTo(11292.84, 2);
  });
  it('keeps a pilot on the ground at height zero', () => {
    const fc = createNetworkPilotGeoJSON([{ ...pilot, onGround: true, altitudeFt: 364 }]);
    expect(fc.features[0]?.properties?.heightM).toBe(0);
  });
  it('keeps the network prefix in its layer ids', () => {
    expect(networkTrafficLayerIds('vatsim')).toEqual(['vatsim-pilots', 'vatsim-labels']);
  });
});

describe('createNetworkRouteGeoJSON', () => {
  const EDDF = { latitude: 50.0333, longitude: 8.5706 };
  const KJFK = { latitude: 40.6413, longitude: -73.7781 };

  it('draws the flown and remaining arcs through the aircraft', () => {
    const fc = createNetworkRouteGeoJSON(pilot, EDDF, KJFK);
    expect(fc.features.map((f) => f.properties?.part)).toEqual(['flown', 'remaining']);
    const remaining = fc.features[1]?.geometry as GeoJSON.LineString;
    expect(remaining.coordinates[0]).toEqual([8.6, 50.1]);
    expect(remaining.coordinates.at(-1)).toEqual([-73.7781, 40.6413]);
    // A great circle to New York bends north of the straight line.
    const mid = remaining.coordinates[Math.floor(remaining.coordinates.length / 2)]!;
    expect(mid[1]).toBeGreaterThan(50.1);
  });
  it('draws only the leg whose airport is known', () => {
    const fc = createNetworkRouteGeoJSON(pilot, null, KJFK);
    expect(fc.features.map((f) => f.properties?.part)).toEqual(['remaining']);
  });
});
