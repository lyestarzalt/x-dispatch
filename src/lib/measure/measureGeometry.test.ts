import { describe, expect, it, vi } from 'vitest';

const mockMagvar = vi.fn();
vi.mock('magvar', () => ({ magvar: (...args: unknown[]) => mockMagvar(...args) }));
mockMagvar.mockReturnValue(6);

const { measureLegs } = await import('./measureGeometry');

const paris = { latitude: 48.86, longitude: 2.35 };
const london = { latitude: 51.47, longitude: -0.46 };
const newYork = { latitude: 40.71, longitude: -73.98 };

describe('measureLegs', () => {
  it('computes one leg per consecutive pair with courses and distance', () => {
    const { legs, totalNm } = measureLegs({ points: [paris, newYork], snap: null });
    expect(legs).toHaveLength(1);
    expect(legs[0]?.initialTrue).toBeCloseTo(291.8, 0);
    expect(legs[0]?.finalTrue).toBeCloseTo(233.7, 0);
    expect(legs[0]?.distanceNm).toBeCloseTo(3149, -1);
    expect(totalNm).toBeCloseTo(3149, -1);
  });

  it('sums the legs of a polyline and keeps the snap on the first leg only', () => {
    const snap = { kind: 'vor' as const, label: 'BRY 114.50', magneticVariation: 2.5 };
    const { legs, totalNm } = measureLegs({ points: [paris, london, newYork], snap });
    expect(legs).toHaveLength(2);
    expect(legs[0]?.snap).toEqual(snap);
    expect(legs[1]?.snap).toBeNull();
    expect(totalNm).toBeCloseTo((legs[0]?.distanceNm ?? 0) + (legs[1]?.distanceNm ?? 0), 6);
  });

  it('uses the station variation at both ends of the first leg only', () => {
    const snap = { kind: 'vor' as const, label: 'BRY 114.50', magneticVariation: 2.5 };
    const { legs } = measureLegs({ points: [paris, london, newYork], snap });
    expect(legs[0]?.startVariation).toBe(2.5);
    expect(legs[0]?.endVariation).toBe(2.5);
    expect(legs[1]?.startVariation).toBe(6);
  });

  it('uses the model at both ends for an NDB or an airport', () => {
    const { legs } = measureLegs({
      points: [paris, newYork],
      snap: { kind: 'ndb', label: 'CTL 385 kHz' },
    });
    expect(legs[0]?.startVariation).toBe(6);
  });
});
