import { describe, expect, it, vi } from 'vitest';
import type { Degrees } from '@/lib/utils/geomath';

const mockMagvar = vi.fn();
vi.mock('magvar', () => ({ magvar: (...args: unknown[]) => mockMagvar(...args) }));

const { magneticToTrue, magneticVariation, trueToMagnetic } = await import('./index');

const deg = (v: number) => v as Degrees;

describe('magneticVariation', () => {
  it('delegates to the magvar package with lat/lon/altitude/date', () => {
    mockMagvar.mockReturnValue(10);
    const date = new Date('2027-06-01T00:00:00Z');
    expect(magneticVariation(45, -120, date)).toBe(10);
    expect(mockMagvar).toHaveBeenCalledWith(45, -120, 0, date);
  });
});

describe('trueToMagnetic', () => {
  it('subtracts east-positive variation from true to get magnetic', () => {
    mockMagvar.mockReturnValue(10);
    expect(trueToMagnetic(deg(90), 45, -120)).toBe(80);
  });

  it('adds the (negative) west variation, since subtracting a negative adds', () => {
    mockMagvar.mockReturnValue(-15);
    expect(trueToMagnetic(deg(90), 45, -120)).toBe(105);
  });

  it('wraps below 0 back into 0..360', () => {
    mockMagvar.mockReturnValue(10);
    expect(trueToMagnetic(deg(5), 45, -120)).toBe(355);
  });

  it('wraps above 360 back into 0..360', () => {
    mockMagvar.mockReturnValue(-10);
    expect(trueToMagnetic(deg(355), 45, -120)).toBe(5);
  });
});

describe('magneticToTrue', () => {
  it('adds east-positive variation back to get true', () => {
    mockMagvar.mockReturnValue(10);
    expect(magneticToTrue(deg(80), 45, -120)).toBe(90);
  });

  it('round-trips with trueToMagnetic for an arbitrary course and variation', () => {
    mockMagvar.mockReturnValue(-7.3);
    const trueDeg = deg(200);
    const magnetic = trueToMagnetic(trueDeg, 10, 10);
    expect(magneticToTrue(magnetic, 10, 10)).toBeCloseTo(200, 5);
  });
});
