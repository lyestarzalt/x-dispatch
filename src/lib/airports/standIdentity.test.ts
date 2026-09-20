import { describe, expect, it } from 'vitest';
import { airlineName, isWideBody, normalizeOperation, normalizeWidthCode } from './standIdentity';

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
