import { describe, expect, it } from 'vitest';
import type { LonLat } from '@/types/geo';
import { createHoldingPattern } from './arcs';
import { destinationPoint, distanceNm } from './index';

const METERS_PER_NM = 1852;
const nm = (a: LonLat, b: LonLat) => distanceNm(a[1], a[0], b[1], b[0]);

/**
 * A racetrack is the fix, a 180-degree turn, the outbound leg, a second 180-degree turn and the
 * inbound leg back to the fix. With 16 points per turn the layout is:
 *   [0] fix · [1..16] first turn · [17] = end of turn 1 (start of outbound)
 *   [17] outbound end · [18..33] second turn · [33] = end of turn 2 (start of inbound) · [34] fix
 */
describe('createHoldingPattern', () => {
  const fix: LonLat = [-79, 40];
  const legNm = 5;
  const radiusNm = 1.25;

  for (const turn of ['R', 'L'] as const) {
    const inbound = 246;
    const outbound = (inbound + 180) % 360;
    const side = turn === 'R' ? 90 : -90;
    const pts = createHoldingPattern(fix, inbound, legNm, turn, radiusNm);
    // Racetrack corners the arcs must meet.
    const outboundStart = destinationPoint(
      fix[1],
      fix[0],
      2 * radiusNm * METERS_PER_NM,
      inbound + side
    );
    const outboundEnd = destinationPoint(
      outboundStart[1],
      outboundStart[0],
      legNm * METERS_PER_NM,
      outbound
    );
    const inboundStart = destinationPoint(fix[1], fix[0], legNm * METERS_PER_NM, outbound);

    describe(`${turn} turns`, () => {
      it('is a closed loop that starts and ends at the fix', () => {
        expect(pts[0]).toEqual(fix);
        expect(pts[pts.length - 1]).toEqual(fix);
        expect(pts).toHaveLength(35);
      });

      it('leaves the fix tangentially: the first arc point is a small step away, not a radius', () => {
        expect(nm(fix, pts[1]!)).toBeLessThan(radiusNm * 0.3);
      });

      it('finishes the first turn at the start of the outbound leg', () => {
        expect(nm(pts[16]!, outboundStart)).toBeLessThan(0.02);
        expect(nm(pts[17]!, outboundEnd)).toBeLessThan(0.02);
      });

      it('starts the second turn at the end of the outbound leg, with a small first step', () => {
        expect(nm(pts[17]!, pts[18]!)).toBeLessThan(radiusNm * 0.3);
      });

      it('finishes the second turn at the start of the inbound leg', () => {
        expect(nm(pts[33]!, inboundStart)).toBeLessThan(0.02);
      });

      it('never steps more than a short arc segment except along the two straight legs', () => {
        const steps = pts.slice(1).map((p, i) => nm(pts[i]!, p));
        const arcStep = (Math.PI * radiusNm) / 16;
        steps.forEach((s, i) => {
          // i = 16 is the outbound leg, i = 33 the inbound leg.
          if (i === 16 || i === 33) expect(s).toBeCloseTo(legNm, 1);
          else expect(s).toBeLessThan(arcStep * 1.2);
        });
      });

      it('keeps the whole pattern on the turn side of the inbound course', () => {
        // Project onto the perpendicular: positive = turn side. Nothing should cross the course line
        // and nothing should sit further out than the full turn diameter.
        const rad = ((inbound + side) * Math.PI) / 180;
        const cosLat = Math.cos((fix[1] * Math.PI) / 180);
        for (const p of pts) {
          const east = (p[0] - fix[0]) * 60 * cosLat;
          const north = (p[1] - fix[1]) * 60;
          const across = east * Math.sin(rad) + north * Math.cos(rad);
          expect(across).toBeGreaterThan(-0.05);
          expect(across).toBeLessThan(2 * radiusNm + 0.05);
        }
      });
    });
  }
});
