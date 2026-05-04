import { describe, expect, it } from 'vitest';
import type { VatsimData } from '@/types/vatsim';
import type { VatsimSectorDataset } from '@/types/vatsimSectors';
import { buildSectorFeatureCollections } from './VatsimSectorLayer';

const dataset: VatsimSectorDataset = {
  version: { vatspy: 'v1', simaware: 's1', builtAt: '2026-05-04T00:00:00.000Z' },
  firs: [
    {
      id: 'EGTT',
      icao: 'EGTT',
      name: 'London',
      callsign: 'EGTT_CTR',
      boundaryId: 'EGTT',
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
      label: [-1, 52],
      oceanic: false,
    },
    {
      id: 'LFBB',
      icao: 'LFBB',
      name: 'Bordeaux',
      callsign: 'LFBB_CTR',
      boundaryId: 'LFBB',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-1, 43],
            [1, 43],
            [1, 45],
            [-1, 45],
            [-1, 43],
          ],
        ],
      },
      label: [0, 44],
      oceanic: false,
    },
  ],
  tracons: [
    {
      id: 'EGLL_APP',
      name: 'Heathrow Approach',
      prefixes: ['EGLL'],
      suffix: 'APP',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-1, 51],
            [0, 51],
            [0, 52],
            [-1, 52],
            [-1, 51],
          ],
        ],
      },
      label: [-0.4, 51.5],
    },
  ],
};

const liveData = {
  general: undefined,
  pilots: [],
  prefiles: [],
  controllers: [
    {
      cid: 1,
      name: 'London Center',
      callsign: 'EGTT_CTR',
      frequency: '128.125',
      facility: 6,
      rating: 8,
      server: 'USA-E',
      visual_range: 300,
      text_atis: null,
      last_updated: '',
      logon_time: '',
    },
    {
      cid: 2,
      name: 'Heathrow Approach',
      callsign: 'EGLL_APP',
      frequency: '119.725',
      facility: 5,
      rating: 8,
      server: 'USA-E',
      visual_range: 100,
      text_atis: null,
      last_updated: '',
      logon_time: '',
    },
  ],
  atis: [],
  lastUpdate: new Date('2026-05-04T00:00:00.000Z'),
} satisfies VatsimData;

describe('buildSectorFeatureCollections', () => {
  it('splits FIRs into active and inactive sources, emits edge label anchors, and emits active tracons', () => {
    const collections = buildSectorFeatureCollections(dataset, liveData.controllers);

    expect(collections.active.features).toHaveLength(1);
    expect(collections.active.features[0]?.properties?.id).toBe('EGTT');

    expect(collections.inactive.features).toHaveLength(1);
    expect(collections.inactive.features[0]?.properties?.id).toBe('LFBB');

    expect(collections.tracon.features).toHaveLength(1);
    expect(collections.tracon.features[0]?.properties?.id).toBe('EGLL_APP');

    expect(collections.labels.features).toHaveLength(2);
    expect(collections.labels.features[0]?.geometry.type).toBe('Point');
    expect(collections.labels.features[0]?.properties?.label).toBe('EGTT');
    expect(collections.labels.features[1]?.properties?.kind).toBe('tracon');
  });
});
