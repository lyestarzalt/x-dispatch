import type * as maplibregl from 'maplibre-gl';
import type { LightColor } from '@/lib/airportLights/taxiwayLights';

export const LIGHT_HEX: Record<LightColor, string> = {
  white: '#fffaeb',
  amber: '#ffbe3c',
  green: '#50ff78',
  blue: '#5a96ff',
  red: '#ff463c',
};

export const LIGHT_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'color'],
  'green',
  LIGHT_HEX.green,
  'blue',
  LIGHT_HEX.blue,
  'amber',
  LIGHT_HEX.amber,
  'red',
  LIGHT_HEX.red,
  LIGHT_HEX.white,
];

export function lightCoreLayerId(haloId: string): string {
  return `${haloId}-core`;
}

interface LightLayerOptions {
  id: string;
  source: string;
  filter?: maplibregl.FilterSpecification;
  minzoom: number;
  /** Multiplies the radius; the feature's own `size` property multiplies again. */
  scale?: number;
}

/**
 * A fixture is two circle layers: a fully blurred halo in the light's colour
 * and a small near-white core. Circles are pure GPU work, so thousands of
 * them cost nothing on the CPU when the camera moves.
 */
export function lightLayers(opts: LightLayerOptions): maplibregl.CircleLayerSpecification[] {
  const scale = opts.scale ?? 1;
  const size: maplibregl.ExpressionSpecification = ['coalesce', ['get', 'size'], 1];
  // Zoom must drive the top-level interpolate; the per-feature size multiplies each stop.
  const radius = (base: number[]): maplibregl.ExpressionSpecification => [
    'interpolate',
    ['exponential', 1.7],
    ['zoom'],
    opts.minzoom,
    ['*', size, base[0]! * scale],
    16,
    ['*', size, base[1]! * scale],
    18,
    ['*', size, base[2]! * scale],
    20,
    ['*', size, base[3]! * scale],
  ];
  const common = {
    source: opts.source,
    minzoom: opts.minzoom,
    ...(opts.filter ? { filter: opts.filter } : {}),
  };
  return [
    {
      id: opts.id,
      type: 'circle',
      ...common,
      paint: {
        'circle-color': LIGHT_COLOR_EXPR,
        'circle-radius': radius([2.2, 4.5, 9, 18]),
        'circle-blur': 1,
        'circle-opacity': 0,
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: lightCoreLayerId(opts.id),
      type: 'circle',
      ...common,
      paint: {
        'circle-color': LIGHT_HEX.white,
        'circle-radius': radius([0.6, 1.1, 2.2, 4.5]),
        'circle-blur': 0.4,
        'circle-opacity': 0,
        'circle-pitch-alignment': 'map',
      },
    },
  ];
}
