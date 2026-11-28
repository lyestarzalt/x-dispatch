import { describe, expect, it } from 'vitest';
import { gateSearchPaint } from './GateLayer';

describe('gateSearchPaint', () => {
  it('leaves every gate at full strength while there is no search', () => {
    const paint = gateSearchPaint(undefined);
    expect(paint.icon['icon-opacity']).toBe(1);
    expect(paint.label['text-opacity']).toBe(1);
    expect(paint.ring['circle-stroke-opacity']).toBe(1);
    expect(JSON.stringify(paint.ring)).not.toContain('"in"');
  });

  it('fades the gates a search leaves out and keeps the matches', () => {
    const paint = gateSearchPaint([2, 5]);
    const match = ['in', ['id'], ['literal', [2, 5]]];
    expect(paint.icon['icon-opacity']).toEqual([
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      1,
      ['==', ['get', 'locationType'], 'helipad'],
      1,
      match,
      1,
      0.25,
    ]);
    // A matching gate gets the white ring a hovered gate has.
    expect(paint.ring['circle-stroke-color']).toContainEqual(match);
  });

  it('fades every gate when the search matches none', () => {
    const paint = gateSearchPaint([]);
    expect(paint.label['text-opacity']).toContainEqual(['in', ['id'], ['literal', []]]);
  });
});
