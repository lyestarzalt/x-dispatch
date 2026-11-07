import { describe, expect, it } from 'vitest';
import {
  airlineName,
  isWideBody,
  normalizeOperation,
  normalizeWidthCode,
  smallestStandCodeFor,
  standFits,
} from './standIdentity';

describe('standIdentity', () => {
  it('normalises operation types and falls back to none', () => {
    expect(normalizeOperation('Airline')).toBe('airline');
    expect(normalizeOperation('general_aviation')).toBe('general_aviation');
    expect(normalizeOperation(undefined)).toBe('none');
    expect(normalizeOperation('weird')).toBe('none');
  });

  it('accepts only ICAO width codes A to F', () => {
    expect(normalizeWidthCode('c')).toBe('C');
    expect(normalizeWidthCode('G')).toBeUndefined();
    expect(normalizeWidthCode('')).toBeUndefined();
  });

  it('flags E and F as wide-body', () => {
    expect(isWideBody('E')).toBe(true);
    expect(isWideBody('C')).toBe(false);
    expect(isWideBody(undefined)).toBe(false);
  });

  it('resolves known airline designators', () => {
    expect(airlineName('dlh')).toBe('Lufthansa');
    expect(airlineName('XYZ')).toBeUndefined();
  });
});

describe('stand size filter', () => {
  it('picks the narrowest code that takes a wingspan', () => {
    expect(smallestStandCodeFor(10)).toBe('A');
    expect(smallestStandCodeFor(15)).toBe('A');
    expect(smallestStandCodeFor(35.8)).toBe('C');
    expect(smallestStandCodeFor(79.8)).toBe('F');
    expect(smallestStandCodeFor(81)).toBeUndefined();
  });

  it('keeps airports whose widest stand is at least the minimum', () => {
    expect(standFits('E', 'C')).toBe(true);
    expect(standFits('C', 'C')).toBe(true);
    expect(standFits('B', 'C')).toBe(false);
    expect(standFits(undefined, 'A')).toBe(false);
  });
});
