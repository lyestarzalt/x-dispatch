import { describe, expect, it } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { VatsimData } from '@/types/vatsim';
import type { VatsimSectorDataset } from '@/types/vatsimSectors';
import {
  buildActiveFirMatches,
  buildActiveTraconMatches,
  buildAirportAtcSummaries,
  getControllerRole,
} from './match';

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
    {
      id: 'EGLL_TWR',
      name: 'Heathrow Tower Area',
      prefixes: ['EGLL'],
      suffix: 'TWR',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.7, 51.3],
            [-0.2, 51.3],
            [-0.2, 51.7],
            [-0.7, 51.7],
            [-0.7, 51.3],
          ],
        ],
      },
      label: [-0.45, 51.47],
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
      name: 'Heathrow Delivery',
      callsign: 'EGLL_DEL',
      frequency: '121.980',
      facility: 2,
      rating: 8,
      server: 'USA-E',
      visual_range: 50,
      text_atis: null,
      last_updated: '',
      logon_time: '',
    },
    {
      cid: 3,
      name: 'Heathrow Ground',
      callsign: 'EGLL_GND',
      frequency: '121.900',
      facility: 3,
      rating: 8,
      server: 'USA-E',
      visual_range: 50,
      text_atis: null,
      last_updated: '',
      logon_time: '',
    },
    {
      cid: 4,
      name: 'Heathrow Tower',
      callsign: 'EGLL_TWR',
      frequency: '118.700',
      facility: 4,
      rating: 8,
      server: 'USA-E',
      visual_range: 50,
      text_atis: null,
      last_updated: '',
      logon_time: '',
    },
    {
      cid: 5,
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
  atis: [
    {
      cid: 6,
      name: 'Heathrow ATIS',
      callsign: 'EGLL_ATIS',
      frequency: '128.075',
      facility: 0,
      rating: 8,
      server: 'USA-E',
      visual_range: 0,
      atis_code: 'B',
      text_atis: ['ATIS INFO B'],
      last_updated: '',
      logon_time: '',
    },
  ],
  lastUpdate: new Date('2026-05-04T00:00:00.000Z'),
} satisfies VatsimData;

const airports = [
  {
    icao: 'EGLL',
    iataCode: 'LHR',
    name: 'London Heathrow',
    lon: -0.4619,
    lat: 51.4706,
    isCustom: false,
    type: 'land',
    surfaceType: 'paved',
    runwayCount: 2,
    elevation: 83,
    country: 'United Kingdom',
  },
  {
    icao: 'KJFK',
    iataCode: 'JFK',
    name: 'John F Kennedy Intl',
    lon: -73.7781,
    lat: 40.6413,
    isCustom: false,
    type: 'land',
    surfaceType: 'paved',
    runwayCount: 4,
    elevation: 13,
    country: 'United States',
  },
] satisfies Airport[];

describe('getControllerRole', () => {
  it('maps DEL/GND/TWR/APP/CTR/ATIS roles from callsigns', () => {
    expect(getControllerRole(liveData.controllers[0]!)).toBe('CTR');
    expect(getControllerRole(liveData.controllers[1]!)).toBe('DEL');
    expect(getControllerRole(liveData.controllers[2]!)).toBe('GND');
    expect(getControllerRole(liveData.controllers[3]!)).toBe('TWR');
    expect(getControllerRole(liveData.controllers[4]!)).toBe('APP');
    expect(getControllerRole(liveData.atis[0]!)).toBe('ATIS');
  });
});

describe('buildActiveFirMatches', () => {
  it('activates FIRs from CTR/FSS positions only', () => {
    const matches = buildActiveFirMatches(dataset, liveData.controllers);

    expect(matches).toEqual([{ sectorId: 'EGTT', controllers: [liveData.controllers[0]] }]);
  });
});

describe('buildActiveTraconMatches', () => {
  it('matches APP and TWR callsigns to SimAware prefixes and suffixes', () => {
    const matches = buildActiveTraconMatches(dataset, liveData.controllers);

    expect(matches.map((match) => match.traconId)).toEqual(['EGLL_APP', 'EGLL_TWR']);
  });

  it('chooses the best SimAware match instead of activating every prefix match', () => {
    const matches = buildActiveTraconMatches(dataset, [liveData.controllers[4]!]);

    expect(matches.map((match) => match.traconId)).toEqual(['EGLL_APP']);
  });
});

describe('buildAirportAtcSummaries', () => {
  it('groups controllers and ATIS by airport and creates only A/D/G/T badges', () => {
    const summaries = buildAirportAtcSummaries(liveData, airports);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.icao).toBe('EGLL');
    expect(summaries[0]?.badges.map((badge) => badge.letter)).toEqual(['D', 'G', 'T', 'A']);
    expect(summaries[0]?.controllers.map((controller) => controller.callsign)).toEqual([
      'EGLL_DEL',
      'EGLL_GND',
      'EGLL_TWR',
      'EGLL_APP',
      'EGLL_ATIS',
    ]);
  });

  it('resolves short callsigns through airport IATA codes', () => {
    const summaries = buildAirportAtcSummaries(
      {
        ...liveData,
        controllers: [
          {
            ...liveData.controllers[3]!,
            callsign: 'JFK_TWR',
            name: 'Kennedy Tower',
          },
        ],
        atis: [
          {
            ...liveData.atis[0]!,
            callsign: 'JFK_ATIS',
            name: 'Kennedy ATIS',
          },
        ],
      },
      airports
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.icao).toBe('KJFK');
    expect(summaries[0]?.badges.map((badge) => badge.letter)).toEqual(['T', 'A']);
  });
});
