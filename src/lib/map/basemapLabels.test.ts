import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { localizeBasemapLabels, localizeTextField, tileLanguageFor } from './basemapLabels';

const german = [
  'coalesce',
  ['get', 'name:de'],
  ['get', 'name:latin'],
  ['get', 'name_en'],
  ['get', 'name'],
];

describe('tileLanguageFor', () => {
  it('maps app locales to tile columns, English included, and pirate to English', () => {
    expect(tileLanguageFor('de')).toBe('de');
    expect(tileLanguageFor('pt-BR')).toBe('pt');
    expect(tileLanguageFor('en')).toBe('en');
    expect(tileLanguageFor('pirate')).toBe('en');
    expect(tileLanguageFor('xx')).toBeNull();
  });
});

describe('localizeTextField', () => {
  it('replaces the legacy English token and keeps other strings', () => {
    expect(localizeTextField('{name_en}', 'de')).toEqual(german);
    expect(localizeTextField('{name}', 'de')).toBe('{name}');
    expect(localizeTextField('{housenumber}', 'de')).toBe('{housenumber}');
  });

  it('turns a zoom stops function into a step expression', () => {
    const stops = {
      stops: [
        [8, '{name_en}'],
        [13, '{name}'],
      ],
    };
    expect(localizeTextField(stops, 'de')).toEqual(['step', ['zoom'], german, 13, '{name}']);
    const local = {
      stops: [
        [8, '{name}'],
        [13, '{name}'],
      ],
    };
    expect(localizeTextField(local, 'de')).toBe(local);
  });

  it('rewrites English lookups nested in an expression', () => {
    const liberty = [
      'case',
      ['has', 'name:nonlatin'],
      ['concat', ['get', 'name:latin'], ' ', ['get', 'name:nonlatin']],
      ['coalesce', ['get', 'name_en'], ['get', 'name']],
    ];
    expect(localizeTextField(liberty, 'fr')).toEqual([
      'case',
      ['has', 'name:nonlatin'],
      ['concat', ['get', 'name:latin'], ' ', ['get', 'name:nonlatin']],
      [
        'coalesce',
        german.map((e) => (Array.isArray(e) && e[1] === 'name:de' ? ['get', 'name:fr'] : e)),
        ['get', 'name'],
      ],
    ]);
  });

  it('is idempotent and switches language on a second pass', () => {
    const once = localizeTextField('{name_en}', 'de');
    expect(localizeTextField(once, 'de')).toEqual(german);
    expect(localizeTextField(once, 'ja')).toEqual([
      'coalesce',
      ['get', 'name:ja'],
      ['get', 'name:latin'],
      ['get', 'name_en'],
      ['get', 'name'],
    ]);
  });

  it('returns the same reference when nothing changes', () => {
    const ref = ['to-string', ['get', 'ref']];
    expect(localizeTextField(ref, 'de')).toBe(ref);
  });
});

describe('localizeBasemapLabels', () => {
  it('updates only symbol layers that reference the English name', () => {
    const setLayoutProperty = vi.fn();
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'country', type: 'symbol', layout: { 'text-field': '{name_en}' } },
          { id: 'town', type: 'symbol', layout: { 'text-field': '{name}' } },
          { id: 'water', type: 'fill', layout: {} },
          { id: 'shield', type: 'symbol', layout: { 'text-field': ['to-string', ['get', 'ref']] } },
        ],
      }),
      setLayoutProperty,
    } as unknown as maplibregl.Map;

    localizeBasemapLabels(map, 'de');
    expect(setLayoutProperty).toHaveBeenCalledTimes(1);
    expect(setLayoutProperty).toHaveBeenCalledWith('country', 'text-field', german);

    setLayoutProperty.mockClear();
    localizeBasemapLabels(map, 'en');
    expect(setLayoutProperty).toHaveBeenCalledWith('country', 'text-field', [
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name_en'],
      ['get', 'name'],
    ]);

    setLayoutProperty.mockClear();
    localizeBasemapLabels(map, 'xx');
    expect(setLayoutProperty).not.toHaveBeenCalled();
  });
});
