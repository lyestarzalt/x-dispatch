import { describe, expect, it } from 'vitest';
import {
  LIVERY_THUMB_WIDTH,
  clampLiveryThumbWidth,
  liveryCardHeight,
  liveryGridHeight,
} from './liveryGrid';

describe('livery grid sizing', () => {
  it('keeps a stored width inside the slider range and on its steps', () => {
    expect(clampLiveryThumbWidth(200)).toBe(200);
    expect(clampLiveryThumbWidth(40)).toBe(LIVERY_THUMB_WIDTH.min);
    expect(clampLiveryThumbWidth(9000)).toBe(LIVERY_THUMB_WIDTH.max);
    expect(clampLiveryThumbWidth(187)).toBe(180);
  });

  it('falls back to the default for a missing or broken value', () => {
    expect(clampLiveryThumbWidth(undefined)).toBe(LIVERY_THUMB_WIDTH.default);
    expect(clampLiveryThumbWidth(Number.NaN)).toBe(LIVERY_THUMB_WIDTH.default);
    expect(clampLiveryThumbWidth('big')).toBe(LIVERY_THUMB_WIDTH.default);
  });

  it('sizes a card as a 16:9 picture plus its name', () => {
    expect(liveryCardHeight(160)).toBe(90 + 28);
    expect(liveryCardHeight(320)).toBe(180 + 28);
  });

  it('shows two rows of cards', () => {
    expect(liveryGridHeight(160)).toBe(118 * 2 + 12 + 24);
  });

  it('grows the grid with the thumbnail width', () => {
    expect(liveryGridHeight(320)).toBeGreaterThan(liveryGridHeight(200));
  });
});
