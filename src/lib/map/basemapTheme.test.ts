import { describe, expect, it } from 'vitest';
import {
  AIRPORT_DOT_FILL,
  AIRPORT_DOT_STROKE,
  AIRPORT_HALO_FILL,
  AIRPORT_THEME_COLORS,
  getBasemapTheme,
} from './basemapTheme';

describe('getBasemapTheme', () => {
  it('classifies the carto-dark preset as dark', () => {
    expect(
      getBasemapTheme('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    ).toBe('dark');
  });

  it('classifies positron and liberty as light', () => {
    expect(getBasemapTheme('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')).toBe(
      'light'
    );
    expect(getBasemapTheme('https://tiles.openfreemap.org/styles/liberty')).toBe('light');
  });

  it('classifies the esri imagery preset as satellite', () => {
    expect(
      getBasemapTheme(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      )
    ).toBe('satellite');
  });

  it('falls back to custom for unknown URLs', () => {
    expect(getBasemapTheme('https://tiles.example.com/styles/custom')).toBe('custom');
    expect(getBasemapTheme('')).toBe('custom');
  });
});

describe('AIRPORT_THEME_COLORS', () => {
  it('uses light palette as the custom fallback', () => {
    expect(AIRPORT_THEME_COLORS.custom).toBe(AIRPORT_THEME_COLORS.light);
  });

  it('exposes a label/pin entry for every theme', () => {
    for (const theme of ['dark', 'light', 'satellite', 'custom'] as const) {
      const c = AIRPORT_THEME_COLORS[theme];
      expect(c.pinBodyColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.labelDefault).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.labelHalo).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('Airport dot constants', () => {
  it('uses brand cyan + dark hairline + white halo regardless of theme', () => {
    expect(AIRPORT_DOT_FILL).toMatch(/^#[0-9a-f]{6}$/i);
    expect(AIRPORT_DOT_STROKE).toMatch(/^#[0-9a-f]{6}$/i);
    expect(AIRPORT_HALO_FILL).toBe('#ffffff');
  });
});
