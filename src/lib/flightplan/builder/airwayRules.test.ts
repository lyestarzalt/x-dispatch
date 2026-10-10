import { describe, expect, it } from 'vitest';
import type { AirwaySegment } from '@/types/navigation';
import {
  bandAllows,
  narrowBand,
  pairBand,
  segmentAllowsDirection,
  segmentsForPair,
} from './airwayRules';

const seg = (
  from: string,
  to: string,
  direction: 0 | 1 | 2,
  baseFl = 0,
  topFl = 0
): AirwaySegment =>
  ({ name: 'L1', fromFix: from, toFix: to, direction, baseFl, topFl }) as AirwaySegment;

describe('segmentAllowsDirection', () => {
  it('allows both ways on a two-way segment', () => {
    expect(segmentAllowsDirection(seg('A', 'B', 0), 'A', 'B')).toBe(true);
    expect(segmentAllowsDirection(seg('A', 'B', 0), 'B', 'A')).toBe(true);
  });
  it('allows only the stored way on a forward segment', () => {
    expect(segmentAllowsDirection(seg('A', 'B', 1), 'A', 'B')).toBe(true);
    expect(segmentAllowsDirection(seg('A', 'B', 1), 'B', 'A')).toBe(false);
  });
  it('allows only the reverse way on a backward segment', () => {
    expect(segmentAllowsDirection(seg('A', 'B', 2), 'A', 'B')).toBe(false);
    expect(segmentAllowsDirection(seg('A', 'B', 2), 'B', 'A')).toBe(true);
  });
});

describe('bandAllows', () => {
  it('treats an empty band as open', () => {
    expect(bandAllows(seg('A', 'B', 0), 410)).toBe(true);
  });
  it('checks the base and an open or closed top', () => {
    expect(bandAllows(seg('A', 'B', 0, 245, 460), 410)).toBe(true);
    expect(bandAllows(seg('A', 'B', 0, 245, 0), 410)).toBe(true);
    expect(bandAllows(seg('A', 'B', 0, 245, 460), 90)).toBe(false);
    expect(bandAllows(seg('A', 'B', 0, 85, 245), 410)).toBe(false);
  });
});

describe('pairBand', () => {
  it('converts flight levels to feet and keeps an open top open', () => {
    expect(pairBand([seg('A', 'B', 0, 245, 460)])).toEqual({ minFt: 24500, maxFt: 46000 });
    expect(pairBand([seg('A', 'B', 0, 245, 0)])).toEqual({ minFt: 24500, maxFt: null });
  });
  it('takes the most permissive of duplicate rows', () => {
    expect(pairBand([seg('A', 'B', 0, 245, 460), seg('A', 'B', 0, 85, 245)])).toEqual({
      minFt: 8500,
      maxFt: 46000,
    });
    expect(pairBand([seg('A', 'B', 0, 245, 460), seg('A', 'B', 0)])).toEqual({
      minFt: null,
      maxFt: null,
    });
  });
});

describe('segmentsForPair and narrowBand', () => {
  it('finds a pair either way round', () => {
    const all = [seg('A', 'B', 1), seg('B', 'C', 1)];
    expect(segmentsForPair(all, 'B', 'A')).toHaveLength(1);
    expect(segmentsForPair(all, 'A', 'C')).toHaveLength(0);
  });
  it('keeps the highest floor and lowest ceiling', () => {
    const band = narrowBand({ minFt: 8500, maxFt: null }, { minFt: 24500, maxFt: 46000 });
    expect(band).toEqual({ minFt: 24500, maxFt: 46000 });
    expect(narrowBand(band, { minFt: null, maxFt: 41000 })).toEqual({
      minFt: 24500,
      maxFt: 41000,
    });
  });
});
