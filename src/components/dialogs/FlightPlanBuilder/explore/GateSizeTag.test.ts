import { describe, expect, it } from 'vitest';
import { smallerStandCode } from './GateSizeTag';

describe('smallerStandCode', () => {
  it('picks the tighter end of a city pair', () => {
    expect(smallerStandCode('F', 'C')).toBe('C');
    expect(smallerStandCode('B', 'E')).toBe('B');
    expect(smallerStandCode('D', 'D')).toBe('D');
  });

  it('is unknown when either end is unknown', () => {
    expect(smallerStandCode(undefined, 'C')).toBeUndefined();
    expect(smallerStandCode('F', undefined)).toBeUndefined();
  });
});
