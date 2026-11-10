import { describe, expect, it } from 'vitest';
import { orderFavoriteAirports } from './useFavoriteAirports';

describe('orderFavoriteAirports', () => {
  const names = new Map([
    ['KBOS', 'Boston Logan Intl'],
    ['TIST', 'St Thomas - Cyril E King'],
    ['CYUL', 'Montreal Trudeau'],
  ]);

  it('puts the home airport first, then the favorites in the order they were added', () => {
    expect(orderFavoriteAirports(['TIST', 'KBOS'], 'CYUL', names)).toEqual([
      { icao: 'CYUL', name: 'Montreal Trudeau', isHome: true },
      { icao: 'TIST', name: 'St Thomas - Cyril E King', isHome: false },
      { icao: 'KBOS', name: 'Boston Logan Intl', isHome: false },
    ]);
  });

  it('lists a home airport that is also a favorite once, at its favorite place', () => {
    expect(orderFavoriteAirports(['TIST', 'KBOS'], 'KBOS', names).map((r) => r.icao)).toEqual([
      'TIST',
      'KBOS',
    ]);
  });

  it('keeps an airport the nav data no longer has, without a name', () => {
    expect(orderFavoriteAirports(['XXXX'], null, names)).toEqual([
      { icao: 'XXXX', name: null, isHome: false },
    ]);
  });
});
