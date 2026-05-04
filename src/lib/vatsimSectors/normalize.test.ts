import { describe, expect, it } from 'vitest';
import { buildSectorDataset, normalizeSimawareData, normalizeVatspyData } from './normalize';

const VATSPY_DAT = `
[Countries]
United Kingdom|EG|Center

[Airports]
EGLL|London Heathrow|51.4706|-0.4619|LHR|EGTT|0

[FIRs]
EGTT|London|EGTT_CTR|EGTT
KZNY|New York|KZNY_CTR|KZNY

[UIRs]
EGTT|London Upper|EGTT,KZNY
`.trim();

const FIR_BOUNDARIES = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'EGTT', oceanic: '0', label_lon: '-1.0', label_lat: '52.0' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-2, 51],
            [0, 51],
            [0, 53],
            [-2, 53],
            [-2, 51],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'KZNY', oceanic: '0', label_lon: '-73.0', label_lat: '41.0' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-74, 40],
            [-72, 40],
            [-72, 42],
            [-74, 42],
            [-74, 40],
          ],
        ],
      },
    },
  ],
});

const SIMAWARE = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {
        id: 'JFK_APP',
        prefix: ['KJFK', 'JFK'],
        suffix: 'APP',
        name: 'Kennedy Approach',
        label_lat: 40.7,
        label_lon: -73.8,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-74.0, 40.5],
            [-73.6, 40.5],
            [-73.6, 40.9],
            [-74.0, 40.9],
            [-74.0, 40.5],
          ],
        ],
      },
    },
  ],
};

describe('normalizeVatspyData', () => {
  it('extracts FIR metadata from DAT and joins it to boundary geometry', () => {
    const firs = normalizeVatspyData('vatspy-v1', VATSPY_DAT, FIR_BOUNDARIES);

    expect(firs).toHaveLength(2);
    expect(firs[0]).toMatchObject({
      id: 'EGTT',
      icao: 'EGTT',
      name: 'London',
      callsign: 'EGTT_CTR',
      boundaryId: 'EGTT',
      label: [-1, 52],
      oceanic: false,
    });
  });

  it('skips FIR rows whose boundary does not exist in the geojson', () => {
    const brokenDat = `${VATSPY_DAT}\nMISSING|Missing|MISS_CTR|MISSING`;
    const firs = normalizeVatspyData('vatspy-v1', brokenDat, FIR_BOUNDARIES);

    expect(firs.some((fir) => fir.id === 'MISSING')).toBe(false);
  });
});

describe('normalizeSimawareData', () => {
  it('keeps prefixes, suffix, label, and geometry', () => {
    const tracons = normalizeSimawareData('simaware-v1', SIMAWARE);

    expect(tracons).toEqual([
      expect.objectContaining({
        id: 'JFK_APP',
        prefixes: ['KJFK', 'JFK'],
        suffix: 'APP',
        name: 'Kennedy Approach',
        label: [-73.8, 40.7],
      }),
    ]);
  });

  it('sorts suffix-qualified sectors before generic ones so matching prefers the specific shape', () => {
    const tracons = normalizeSimawareData('simaware-v1', {
      ...SIMAWARE,
      features: [
        {
          type: 'Feature' as const,
          properties: {
            id: 'JFK_GENERIC',
            prefix: ['KJFK'],
            name: 'Kennedy Generic',
          },
          geometry: SIMAWARE.features[0]!.geometry,
        },
        SIMAWARE.features[0]!,
      ],
    });

    expect(tracons.map((tracon) => tracon.id)).toEqual(['JFK_APP', 'JFK_GENERIC']);
  });
});

describe('buildSectorDataset', () => {
  it('merges normalized VATSpy and SimAware into one dataset', () => {
    const dataset = buildSectorDataset({
      vatspyVersion: 'vatspy-v1',
      simawareVersion: 'simaware-v1',
      dat: VATSPY_DAT,
      boundariesText: FIR_BOUNDARIES,
      simaware: SIMAWARE,
      builtAt: '2026-05-04T00:00:00.000Z',
    });

    expect(dataset.version).toEqual({
      vatspy: 'vatspy-v1',
      simaware: 'simaware-v1',
      builtAt: '2026-05-04T00:00:00.000Z',
    });
    expect(dataset.firs).toHaveLength(2);
    expect(dataset.tracons).toHaveLength(1);
  });
});
