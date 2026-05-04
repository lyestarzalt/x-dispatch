import type maplibregl from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensurePillImage } from './badgeImages';

type MockCanvasContext = {
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  measureText: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  quadraticCurveTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
};

function createMockCanvasContext(): MockCanvasContext {
  return {
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    scale: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    })),
  };
}

describe('ensurePillImage', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn(() => {
        const context = createMockCanvasContext();
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => context),
        };
      }),
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('passes the full high-resolution bitmap dimensions when pixelRatio is set', () => {
    const addImage = vi.fn();
    const map = {
      hasImage: vi.fn(() => false),
      addImage,
    } as unknown as maplibregl.Map;

    ensurePillImage(map, 'badge-a', 'A', {
      backgroundColor: '#000',
      borderColor: '#fff',
      textColor: '#fff',
      fontSize: 11,
      height: 18,
      minWidth: 18,
      paddingX: 4,
      radius: 5,
      pixelRatio: 3,
    });

    expect(addImage).toHaveBeenCalledTimes(1);

    const [, image, options] = addImage.mock.calls[0]!;
    expect(image.width).toBe(54);
    expect(image.height).toBe(54);
    expect(image.data).toHaveLength(54 * 54 * 4);
    expect(options).toEqual({ pixelRatio: 3 });
  });
});
