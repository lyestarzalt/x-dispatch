import { describe, expect, it } from 'vitest';
import { terrainShadingAllowed } from './terrainShading';

describe('terrainShadingAllowed', () => {
  it('is off on an imagery basemap, where hillshade only muddies the photo', () => {
    expect(
      terrainShadingAllowed(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      )
    ).toBe(false);
  });

  it('is allowed on vector styles', () => {
    expect(terrainShadingAllowed('https://tiles.openfreemap.org/styles/dark')).toBe(true);
    expect(terrainShadingAllowed('https://example.com/custom/style.json')).toBe(true);
  });
});
