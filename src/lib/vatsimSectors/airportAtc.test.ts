import { describe, expect, it } from 'vitest';
import type { VatsimATIS, VatsimController } from '@/types/vatsim';
import { buildAirportAtcRows } from './airportAtc';

const controllers: VatsimController[] = [
  {
    cid: 4,
    name: 'Heathrow Approach',
    callsign: 'EGLL_APP',
    frequency: '119.725',
    facility: 5,
    rating: 8,
    server: 'USA-E',
    visual_range: 50,
    text_atis: null,
    last_updated: '',
    logon_time: '',
  },
  {
    cid: 2,
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
    cid: 1,
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
];

const atis: VatsimATIS[] = [
  {
    cid: 5,
    name: 'Heathrow ATIS',
    callsign: 'EGLL_ATIS',
    frequency: '128.075',
    facility: 0,
    rating: 8,
    server: 'USA-E',
    visual_range: 0,
    atis_code: 'B',
    text_atis: ['ATIS INFO B', 'RWY 27R IN USE'],
    last_updated: '',
    logon_time: '',
  },
];

describe('buildAirportAtcRows', () => {
  it('sorts controllers by facility flow and preserves ATIS detail text', () => {
    const rows = buildAirportAtcRows(controllers, atis);

    expect(rows.map((row) => row.badgeLabel)).toEqual(['DEL', 'GND', 'APP', 'ATIS B']);
    expect(rows[0]?.callsign).toBe('EGLL_DEL');
    expect(rows[3]?.detail).toBe('ATIS INFO B | RWY 27R IN USE');
    expect(rows[3]?.badgeVariant).toBe('warning');
  });
});
