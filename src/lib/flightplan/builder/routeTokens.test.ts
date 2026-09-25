import { describe, expect, it } from 'vitest';
import { lexRoute, parseLatLon, stripEndpoints, tokenizeRoute } from './routeTokens';

describe('routeTokens', () => {
  it('splits on whitespace and separators and upper-cases', () => {
    expect(tokenizeRoute(' sugol ul620,kekix;t180  osn ')).toEqual([
      'SUGOL',
      'UL620',
      'KEKIX',
      'T180',
      'OSN',
    ]);
  });

  it('classifies airways, idents, directs and coordinates', () => {
    const kinds = lexRoute('SUGOL UL620 KEKIX DCT 5230N01000E OSN').map((t) => t.kind);
    expect(kinds).toEqual(['ident', 'airway', 'ident', 'direct', 'latlon', 'ident']);
  });

  it('treats a second airway in a row as an ident', () => {
    const kinds = lexRoute('UL620 T180').map((t) => t.kind);
    expect(kinds).toEqual(['airway', 'ident']);
  });

  it('parses both coordinate spellings', () => {
    expect(parseLatLon('5230N01000W')).toEqual({ latitude: 52.5, longitude: -10 });
    expect(parseLatLon('52N010E')).toEqual({ latitude: 52, longitude: 10 });
    expect(parseLatLon('-33.9/151.2')).toEqual({ latitude: -33.9, longitude: 151.2 });
    expect(parseLatLon('9999N')).toBeNull();
  });

  it('strips airports typed at either end', () => {
    const tokens = lexRoute('EHAM SUGOL EDDF');
    expect(stripEndpoints(tokens, 'eham', 'EDDF').map((t) => t.text)).toEqual(['SUGOL']);
  });
});

describe('lexRoute NAT tracks', () => {
  it('treats a NAT designator as an airway between its entry and exit fixes', () => {
    const kinds = lexRoute('MIMKU DCT GOMUP NATC CUDDY').map((t) => t.kind);
    expect(kinds).toEqual(['ident', 'direct', 'ident', 'airway', 'ident']);
  });
});
