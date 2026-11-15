import { describe, expect, it } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { IvaoAtc } from '@/types/ivao';
import type { NetworkPilot } from '@/types/networkTraffic';
import type { VatsimATIS, VatsimController } from '@/types/vatsim';
import { roleFromCallsign, stationLabel, topRole } from './atcRoles';
import { atisLetterFromText, atisRunways } from './atis';
import {
  buildAirportStaffing,
  fromIvaoAtc,
  fromVatsimAtis,
  fromVatsimController,
  stationAirport,
  trafficCountsByAirport,
} from './stations';

const airports = [
  { icao: 'EGLL', name: 'Heathrow', lat: 51.47, lon: -0.46, iataCode: 'LHR' },
  { icao: 'KJFK', name: 'Kennedy', lat: 40.64, lon: -73.78, iataCode: 'JFK' },
] as Airport[];

function controller(callsign: string, frequency = '118.500'): VatsimController {
  return {
    cid: 1,
    name: 'Some One',
    callsign,
    frequency,
    facility: 4,
    rating: 5,
    server: 'UK',
    visual_range: 50,
    text_atis: null,
    last_updated: '',
    logon_time: '',
  };
}

const atis: VatsimATIS = {
  ...controller('EGLL_ATIS', '128.075'),
  atis_code: 'K',
  text_atis: ['LONDON HEATHROW INFORMATION K', 'RWY 27L IN USE'],
};

const ivaoTower: IvaoAtc = {
  id: 5,
  userId: 9,
  callsign: 'JFK_TWR',
  serverId: 'EU',
  softwareTypeId: 'aurora',
  softwareVersion: '1',
  rating: 4,
  createdAt: '',
  updatedAt: '',
  lastTrack: { latitude: 40.6, longitude: -73.8, altitude: 0, timestamp: '', transponder: 0 },
  atis: {
    lines: [
      'ts-1.us-east-1.ivao.aero/JFK_TWR',
      'KENNEDY TOWER',
      'INFORMATION C 1250Z',
      'RUNWAY 04L',
    ],
    revision: 'C',
    timestamp: '',
  },
  atcSession: { frequency: 119.1, position: 'TWR' },
};

describe('roleFromCallsign', () => {
  it('reads the suffix, folding DEP into APP and RMP into GND', () => {
    expect(roleFromCallsign('EGLL_TWR')).toBe('TWR');
    expect(roleFromCallsign('EGLL_N_DEP')).toBe('APP');
    expect(roleFromCallsign('EGLL_RMP')).toBe('GND');
    expect(roleFromCallsign('LON_CTR')).toBe('CTR');
    expect(roleFromCallsign('EGLL_OBS')).toBe('OTHER');
  });
});

describe('atis text', () => {
  it('finds the information letter and the runways', () => {
    expect(atisLetterFromText(['INFORMATION C 1250Z'])).toBe('C');
    expect(atisLetterFromText(['ATIS INFO K'])).toBe('K');
    expect(atisLetterFromText(['Brasilia ATIS Information NOVEMBER recorded at 0804z'])).toBe('N');
    expect(atisLetterFromText(['NOTHING HERE'])).toBeNull();
    expect(atisRunways(['RWY 27L IN USE', 'RUNWAY 09 AND RY 27R'])).toEqual(['27L', '09', '27R']);
  });
});

describe('adapters', () => {
  it('maps a VATSIM controller and ATIS', () => {
    expect(fromVatsimController(controller('EGLL_TWR'))).toMatchObject({
      network: 'vatsim',
      role: 'TWR',
      frequency: '118.500',
      atis: null,
    });
    const a = fromVatsimAtis(atis);
    expect(a.role).toBe('ATIS');
    expect(a.atis).toEqual({ code: 'K', lines: atis.text_atis });
    expect(stationLabel(a)).toBe('ATIS K');
  });
  it('maps an IVAO controller with its ATIS and formats the frequency', () => {
    const s = fromIvaoAtc(ivaoTower);
    expect(s).toMatchObject({ network: 'ivao', role: 'TWR', frequency: '119.100' });
    expect(s?.atis?.code).toBe('C');
    expect(s?.atis?.lines[0]).toBe('KENNEDY TOWER');
    const bare = fromIvaoAtc({
      ...ivaoTower,
      atis: { lines: ['ts-1.eu-west-2.ivao.aero/JFK_TWR'], revision: 'Z', timestamp: '' },
    });
    expect(bare?.atis).toBeNull();
    expect(fromIvaoAtc({ ...ivaoTower, atcSession: null })).toBeNull();
  });
});

describe('stationAirport', () => {
  it('takes an ICAO prefix as is and resolves IATA through the airport list', () => {
    expect(stationAirport('EGLL_TWR', airports)).toBe('EGLL');
    expect(stationAirport('JFK_GND', airports)).toBe('KJFK');
    expect(stationAirport('LON_CTR', airports)).toBeNull();
  });
});

describe('buildAirportStaffing', () => {
  it('groups airport positions, orders the roles and picks the ring role', () => {
    const stations = [
      fromVatsimController(controller('EGLL_N_APP')),
      fromVatsimController(controller('EGLL_DEL')),
      fromVatsimController(controller('LON_CTR')),
      fromVatsimAtis(atis),
    ];
    const staffing = buildAirportStaffing(stations, airports);
    expect(Object.keys(staffing)).toEqual(['EGLL']);
    expect(staffing.EGLL).toMatchObject({ roles: ['DEL', 'APP'], top: 'APP', atisCode: 'K' });
    expect(staffing.EGLL?.stations.map((s) => s.role)).toEqual(['ATIS', 'DEL', 'APP']);
  });
  it('an airport with only ATIS rings amber', () => {
    const staffing = buildAirportStaffing([fromVatsimAtis(atis)], airports);
    expect(staffing.EGLL?.top).toBe('ATIS');
    expect(staffing.EGLL?.roles).toEqual([]);
    expect(topRole(['TWR', 'GND'])).toBe('TWR');
  });
});

describe('trafficCountsByAirport', () => {
  it('counts filed departures and arrivals per airport', () => {
    const pilot = (departure: string, arrival: string) =>
      ({ flightPlan: { departure, arrival } }) as NetworkPilot;
    const counts = trafficCountsByAirport([
      pilot('EGLL', 'KJFK'),
      pilot('EGLL', 'LFPG'),
      pilot('KJFK', 'EGLL'),
      { flightPlan: null } as NetworkPilot,
    ]);
    expect(counts.get('EGLL')).toEqual({ departures: 2, arrivals: 1 });
    expect(counts.get('KJFK')).toEqual({ departures: 1, arrivals: 1 });
    expect(counts.get('EDDF')).toBeUndefined();
  });
});
