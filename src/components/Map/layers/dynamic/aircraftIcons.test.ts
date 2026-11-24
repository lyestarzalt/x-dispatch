import type * as maplibregl from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAircraftIcons, ensureFallbackIcon } from './aircraftIcons';

/**
 * A map whose style can be torn down mid-test. MapLibre's `remove()` leaves
 * `style` null, and `hasImage` then throws exactly what Sentry X-DISPATCH-9T saw.
 */
function removableMap() {
  const map = {
    style: {} as object | null,
    hasImage: vi.fn((): boolean => {
      if (!map.style) throw new TypeError("Cannot read properties of null (reading 'getImage')");
      return false;
    }),
    addImage: vi.fn(),
  };
  return map;
}

/** Stand-ins for the browser APIs the SVG rasterizer uses, enough to return image data. */
function stubBrowserRendering(onFetch: () => void) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      onFetch();
      return { ok: true, text: async () => '<svg xmlns="http://www.w3.org/2000/svg"/>' };
    })
  );
  vi.stubGlobal(
    'DOMParser',
    class {
      parseFromString() {
        return {
          querySelector: () => null,
          querySelectorAll: () => [],
          documentElement: { setAttribute: () => undefined },
        };
      }
    }
  );
  vi.stubGlobal(
    'XMLSerializer',
    class {
      serializeToString() {
        return '<svg/>';
      }
    }
  );
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
  );
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({
        drawImage: () => undefined,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
      }),
    }),
  });
}

describe('aircraft icons on a map removed while they load', () => {
  let map: ReturnType<typeof removableMap>;

  beforeEach(() => {
    map = removableMap();
    stubBrowserRendering(() => {
      map.style = null;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // X-DISPATCH-9T: the fallback silhouette finished loading after the map was gone.
  it('drops the fallback icon instead of throwing', async () => {
    await expect(ensureFallbackIcon(map as unknown as maplibregl.Map)).resolves.toBeUndefined();
    expect(map.addImage).not.toHaveBeenCalled();
  });

  it('drops a type icon instead of throwing', async () => {
    await expect(
      ensureAircraftIcons(map as unknown as maplibregl.Map, ['B738'])
    ).resolves.toBeUndefined();
    expect(map.addImage).not.toHaveBeenCalled();
  });

  it('still adds the icon when the map stays', async () => {
    const kept = removableMap();
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      text: async () => '<svg xmlns="http://www.w3.org/2000/svg"/>',
    }));
    await ensureFallbackIcon(kept as unknown as maplibregl.Map);
    expect(kept.addImage).toHaveBeenCalledTimes(1);
  });
});
