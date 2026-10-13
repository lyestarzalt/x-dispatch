import { describe, expect, it } from 'vitest';
import { at } from './__fixtures__/routes';
import { buildGeometry, toLocal } from './geometry';
import { trackProgress } from './progress';

/** Out north for 500 m on 50 m nodes, 60 m east, then back south on a parallel line. */
function outAndBack() {
  const xy: [number, number][] = [];
  for (let y = 0; y <= 500; y += 50) xy.push([0, y]);
  for (let y = 500; y >= 0; y -= 50) xy.push([60, y]);
  return buildGeometry(xy.map(([x, y]) => at(x, y)));
}

describe('trackProgress', () => {
  it('finds how far along and how far off the route the aircraft is', () => {
    const g = outAndBack();
    const p = toLocal(g, at(5, 120).lat, at(5, 120).lon);
    const progress = trackProgress(g, p, null)!;
    expect(progress.along).toBeCloseTo(120, 0);
    expect(progress.lateral).toBeCloseTo(5, 0);
  });

  it('stays on the outbound leg even when the parallel return leg is closer', () => {
    const g = outAndBack();
    const p = toLocal(g, at(35, 200).lat, at(35, 200).lon);
    // From scratch the closer, later leg wins…
    expect(trackProgress(g, p, null)!.along).toBeGreaterThan(560);
    // …but following the aircraft from 150 m it stays on the leg it is taxiing.
    const progress = trackProgress(g, p, { segIndex: 3, along: 150, lateral: 2, joined: true })!;
    expect(progress.along).toBeCloseTo(200, 0);
  });

  it('re-finds the aircraft anywhere on the route once it has left the search window', () => {
    const g = outAndBack();
    const p = toLocal(g, at(60, 100).lat, at(60, 100).lon);
    const progress = trackProgress(g, p, { segIndex: 0, along: 10, lateral: 1, joined: true })!;
    expect(progress.along).toBeCloseTo(960, 0);
    expect(progress.lateral).toBeCloseTo(0, 0);
  });
});
