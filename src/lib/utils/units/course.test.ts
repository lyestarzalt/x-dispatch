import { describe, expect, it, vi } from 'vitest';
import type { Degrees } from '@/lib/utils/geomath';

const mockMagvar = vi.fn();
vi.mock('magvar', () => ({ magvar: (...args: unknown[]) => mockMagvar(...args) }));

const { formatCourse, formatCourseWithVariation } = await import('./course');

const deg = (v: number) => v as Degrees;
const t = (key: string) => ({ 'units.degM': 'M', 'units.degT': 'T' })[key] ?? key;

describe('formatCourse', () => {
  it('formats magnetic mode as a 3-digit padded course with M suffix', () => {
    mockMagvar.mockReturnValue(6); // true 303 -> magnetic 297
    expect(formatCourse(deg(303), 'magnetic', 45, -120, t)).toBe('297°M');
  });

  it('formats true mode as a 3-digit padded course with T suffix', () => {
    mockMagvar.mockReturnValue(6);
    expect(formatCourse(deg(303), 'true', 45, -120, t)).toBe('303°T');
  });

  it('formats both modes together', () => {
    mockMagvar.mockReturnValue(6);
    expect(formatCourse(deg(303), 'both', 45, -120, t)).toBe('297°M · 303°T');
  });

  it('pads small courses to three digits', () => {
    mockMagvar.mockReturnValue(0);
    expect(formatCourse(deg(7), 'true', 45, -120, t)).toBe('007°T');
  });

  it('rounds fractional courses before padding', () => {
    mockMagvar.mockReturnValue(0);
    expect(formatCourse(deg(89.6), 'true', 45, -120, t)).toBe('090°T');
  });
});

describe('formatCourseWithVariation', () => {
  it('uses the given variation directly, no position/WMM lookup', () => {
    // A known per-station variation (e.g. decoded from an ILS record), not WMM.
    expect(formatCourseWithVariation(deg(109), 'magnetic', 11, t)).toBe('098°M');
    expect(mockMagvar).not.toHaveBeenCalled();
  });

  it('wraps below 0 back into 0..360', () => {
    expect(formatCourseWithVariation(deg(5), 'magnetic', 10, t)).toBe('355°M');
  });
});
