import { describe, expect, it } from 'vitest';
import { createLayerRenderers } from './index';

describe('createLayerRenderers', () => {
  it('draws the pavement polygons through exactly one fill renderer', () => {
    const renderers = createLayerRenderers();
    const onPavementSource = renderers.filter((r) => r.sourceId === 'airport-pavements');
    expect(onPavementSource.map((r) => r.layerId)).toEqual(['airport-pavements']);
  });

  it('has no renderer with the retired taxiway fill id', () => {
    const ids = createLayerRenderers().flatMap((r) => [r.layerId, ...(r.additionalLayerIds ?? [])]);
    expect(ids).not.toContain('airport-taxiways');
  });
});
