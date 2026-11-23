import { describe, expect, it } from 'vitest';
import { hexToRgb } from './color';

describe('hexToRgb', () => {
  it('reads six hex digits with or without the hash, in either case', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
    expect(hexToRgb('0A141E')).toEqual([10, 20, 30]);
  });

  it('returns null for anything else', () => {
    expect(hexToRgb('#fff')).toBeNull();
    expect(hexToRgb('rgb(1, 2, 3)')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});
