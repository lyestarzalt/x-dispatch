import type * as maplibregl from 'maplibre-gl';
import type { LightColor } from '@/lib/airportLights/taxiwayLights';

export const LIGHT_RGB: Record<LightColor, [number, number, number]> = {
  white: [255, 250, 235],
  amber: [255, 190, 60],
  green: [80, 255, 120],
  blue: [90, 150, 255],
  red: [255, 70, 60],
};

export const LIGHT_HEX: Record<LightColor, string> = {
  white: '#fffaeb',
  amber: '#ffbe3c',
  green: '#50ff78',
  blue: '#5a96ff',
  red: '#ff463c',
};

const SPRITE_PX = 64;

export function lightSpriteId(color: LightColor): string {
  return `airfield-light-${color}`;
}

/** Expression picking the sprite from a feature's `color` property. */
export const LIGHT_ICON_IMAGE: maplibregl.ExpressionSpecification = [
  'concat',
  'airfield-light-',
  ['get', 'color'],
];

/**
 * One glow sprite per colour: a near-white core with a soft coloured halo
 * baked into the alpha, so the bloom costs nothing at draw time.
 */
export function ensureLightSprites(map: maplibregl.Map): void {
  for (const color of Object.keys(LIGHT_RGB) as LightColor[]) {
    const id = lightSpriteId(color);
    if (map.hasImage(id)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_PX;
    canvas.height = SPRITE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const [r, g, b] = LIGHT_RGB[color];
    const c = SPRITE_PX / 2;
    const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
    halo.addColorStop(0, `rgba(255,255,255,1)`);
    halo.addColorStop(0.16, `rgba(255,255,255,0.95)`);
    halo.addColorStop(0.24, `rgba(${r},${g},${b},0.9)`);
    halo.addColorStop(0.42, `rgba(${r},${g},${b},0.4)`);
    halo.addColorStop(0.7, `rgba(${r},${g},${b},0.1)`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    const data = ctx.getImageData(0, 0, SPRITE_PX, SPRITE_PX);
    map.addImage(id, data, { pixelRatio: 2 });
  }
}

/** Shared symbol layout for fixture layers: no collision work, size grows with zoom. */
export function lightSymbolLayout(
  minZoom: number,
  scale = 1
): maplibregl.SymbolLayerSpecification['layout'] {
  return {
    'icon-image': LIGHT_ICON_IMAGE,
    'icon-size': [
      'interpolate',
      ['exponential', 1.7],
      ['zoom'],
      minZoom,
      0.22 * scale,
      16,
      0.5 * scale,
      18,
      1.1 * scale,
      20,
      2.4 * scale,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'icon-padding': 0,
  };
}
