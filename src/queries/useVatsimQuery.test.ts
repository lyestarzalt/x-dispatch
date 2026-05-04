import { describe, expect, it } from 'vitest';
import type { VatsimData } from '@/types/vatsim';
import { getATISForAirport, getControllersForAirport } from './useVatsimQuery';

const data = {
  general: undefined,
  pilots: [],
  prefiles: [],
  controllers: [
    {
      cid: 1,
      name: 'Kennedy Tower',
      callsign: 'JFK_TWR',
      frequency: '119.100',
      facility: 4,
      rating: 8,
      server: 'USA-E',
      visual_range: 50,
      text_atis: null,
      last_updated: '',
      logon_time: '',
    },
  ],
  atis: [
    {
      cid: 2,
      name: 'Kennedy ATIS',
      callsign: 'JFK_ATIS',
      frequency: '128.725',
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
  lastUpdate: new Date('2026-05-05T00:00:00.000Z'),
} satisfies VatsimData;

describe('airport VATSIM helpers', () => {
  it('matches controllers through airport IATA codes', () => {
    const controllers = getControllersForAirport(data, {
      icao: 'KJFK',
      iata: 'JFK',
    });

    expect(controllers.map((controller) => controller.callsign)).toEqual(['JFK_TWR']);
  });

  it('matches ATIS through airport IATA codes', () => {
    const atis = getATISForAirport(data, {
      icao: 'KJFK',
      iata: 'JFK',
    });

    expect(atis.map((station) => station.callsign)).toEqual(['JFK_ATIS']);
  });
});
