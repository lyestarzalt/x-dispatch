import { describe, expect, it } from 'vitest';
import { gateDimStates } from './GateLayer';

// A search in the airport card's gate list ("heavy") keeps the matching gates bright on the
// map and fades the rest.
describe('gateDimStates', () => {
  it('fades every gate the search does not match', () => {
    expect(gateDimStates(4, new Set([1, 3]))).toEqual([
      { id: 0, dimmed: true },
      { id: 1, dimmed: false },
      { id: 2, dimmed: true },
      { id: 3, dimmed: false },
    ]);
  });

  it('fades nothing without a search', () => {
    expect(gateDimStates(3, null).every((g) => !g.dimmed)).toBe(true);
  });

  it('fades them all when nothing matches', () => {
    expect(gateDimStates(2, new Set()).every((g) => g.dimmed)).toBe(true);
  });
});
