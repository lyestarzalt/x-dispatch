import { describe, expect, it } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { VatsimData } from '@/types/vatsim';
import {
  AIRPORT_ATC_ICON_SIZE,
  buildAirportAtcFeatureCollection,
  getAirportAtcBadgeImageId,
  getAirportAtcBadgeOptions,
} from './VatsimAirportAtcLayer';

const airports = [
  {
    icao: 'EGLL',
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
] as Airport[];

const liveData = {
  general: undefined,
  pilots: [],
  prefiles: [],
  controllers: [
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
      cid: 3,
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
  ],
  atis: [
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
      text_atis: ['ATIS INFO B'],
      last_updated: '',
      logon_time: '',
    },
  ],
  lastUpdate: new Date('2026-05-04T00:00:00.000Z'),
} satisfies VatsimData;

describe('buildAirportAtcFeatureCollection', () => {
  it('keeps the original pill badge look but renders it at higher bitmap resolution', () => {
    expect(getAirportAtcBadgeOptions('T')).toMatchObject({
      textColor: '#fee2e2',
      fontSize: 11,
      height: 18,
      minWidth: 18,
      paddingX: 4,
      radius: 5,
      pixelRatio: 3,
    });
    expect(AIRPORT_ATC_ICON_SIZE).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      0.9,
      8,
      1.2,
      12,
      1.7,
      15,
      2.1,
    ]);
  });

  it('creates text badges for staffed airport positions and builds a structured popup summary', () => {
    const result = buildAirportAtcFeatureCollection(airports, liveData);

    expect(result.collection.features.map((feature) => feature.properties.badgeLetter)).toEqual([
      'D',
      'G',
      'T',
      'A',
    ]);
    expect(result.collection.features.map((feature) => feature.properties.imageId)).toEqual([
      getAirportAtcBadgeImageId('D'),
      getAirportAtcBadgeImageId('G'),
      getAirportAtcBadgeImageId('T'),
      getAirportAtcBadgeImageId('A'),
    ]);
    expect(result.collection.features.every((feature) => feature.properties.icao === 'EGLL')).toBe(
      true
    );
    expect(
      result.collection.features.every(
        (feature) => feature.geometry.coordinates[0] === airports[0]!.lon
      )
    ).toBe(true);
    expect(
      result.collection.features.every(
        (feature) => feature.geometry.coordinates[1] === airports[0]!.lat
      )
    ).toBe(true);
    expect(
      result.collection.features.map((feature) =>
        feature.properties.iconOffset.map((value) => Number(value.toFixed(1)))
      )
    ).toEqual([
      [-27, -22],
      [-9, -22],
      [9, -22],
      [27, -22],
    ]);

    const popup = result.popupMap.get('EGLL') ?? '';
    expect(popup).toContain('London Heathrow');
    expect(popup).toContain('EGLL_APP');
    expect(popup).toContain('Heathrow Delivery');
    expect(popup).toContain('ATIS B');
    expect(popup).toContain('ATIS INFO B');
  });
});
