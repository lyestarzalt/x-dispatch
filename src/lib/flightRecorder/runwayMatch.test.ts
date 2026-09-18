import { describe, expect, it } from 'vitest';
import { destinationPoint } from '@/lib/utils/geomath';
import { type AirportRunways, matchRunway } from './runwayMatch';

const THRESHOLD_09 = { lat: 50, lon: 8 };
const LENGTH_M = 3000;
const [lon27, lat27] = destinationPoint(THRESHOLD_09.lat, THRESHOLD_09.lon, LENGTH_M, 90);

const AIRPORT: AirportRunways = {
  icao: 'TEST',
  name: 'Test Field',
  runways: [
    {
      widthM: 45,
      ends: [
        { name: '09', lat: THRESHOLD_09.lat, lon: THRESHOLD_09.lon },
        { name: '27', lat: lat27, lon: lon27 },
      ],
    },
  ],
};

function pointOnRunway(alongM: number, rightM: number): { lat: number; lon: number } {
  const [lonA, latA] = destinationPoint(THRESHOLD_09.lat, THRESHOLD_09.lon, alongM, 90);
  const [lon, lat] = destinationPoint(latA, lonA, Math.abs(rightM), rightM >= 0 ? 180 : 0);
  return { lat, lon };
}

describe('matchRunway', () => {
  it('finds the landing end from heading and reports threshold distance and offset', () => {
    const p = pointOnRunway(420, 3);
    const result = matchRunway({ ...p, headingDeg: 92 }, [AIRPORT]);
    expect(result).not.toBeNull();
    expect(result!.icao).toBe('TEST');
    expect(result!.runway).toBe('09');
    expect(result!.distancePastThresholdM).toBeCloseTo(420, -1);
    expect(result!.centerlineOffsetM).toBeCloseTo(3, 0);
    expect(result!.runwayLengthM).toBeCloseTo(LENGTH_M, -1);
  });

  it('picks the reciprocal end when landing the other way', () => {
    const p = pointOnRunway(LENGTH_M - 600, -5);
    const result = matchRunway({ ...p, headingDeg: 268 }, [AIRPORT]);
    expect(result!.runway).toBe('27');
    expect(result!.distancePastThresholdM).toBeCloseTo(600, -1);
    expect(result!.centerlineOffsetM).toBeCloseTo(5, 0);
  });

  it('returns null when the heading is off the runway axis', () => {
    const p = pointOnRunway(500, 0);
    expect(matchRunway({ ...p, headingDeg: 180 }, [AIRPORT])).toBeNull();
  });

  it('returns null when the aircraft is beside the runway', () => {
    const p = pointOnRunway(500, 400);
    expect(matchRunway({ ...p, headingDeg: 90 }, [AIRPORT])).toBeNull();
  });

  it('accepts a touchdown slightly short of the threshold', () => {
    const p = pointOnRunway(-50, 0);
    const result = matchRunway({ ...p, headingDeg: 90 }, [AIRPORT]);
    expect(result!.distancePastThresholdM).toBeCloseTo(-50, -1);
  });
});
