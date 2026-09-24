import { describe, expect, it } from 'vitest';
import { parseDataCycleHeader } from './cycleInfo';

describe('parseDataCycleHeader', () => {
  it('reads the cycle out of a stock nav data header', () => {
    expect(
      parseDataCycleHeader(
        'I\n1200 Version - data cycle 2406, build 20251002, metadata NavXP1200. Copyright'
      )
    ).toBe('2406');
  });

  it('gives null when the header has no cycle', () => {
    expect(parseDataCycleHeader('I\n1100 Version')).toBeNull();
  });
});
