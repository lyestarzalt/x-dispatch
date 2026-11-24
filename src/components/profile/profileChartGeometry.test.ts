import { describe, expect, it } from 'vitest';
import {
  areaPath,
  centerDomain,
  linePath,
  makeScales,
  minSpanNm,
  nearestRowIndex,
  niceStep,
  panDomain,
  stepAfterPath,
  ticks,
  ticksBetween,
  zoomDomain,
} from './profileChartGeometry';

const box = { width: 110, height: 120, left: 10, top: 20, right: 110, bottom: 120 };
const s = makeScales(box, [0, 100], 10000);
type Row = { d: number; v: number | null };
const d = (r: Row) => r.d;
const v = (r: Row) => r.v;

describe('makeScales', () => {
  it('maps distance across the plot and altitude bottom-up', () => {
    expect(s.x(0)).toBe(10);
    expect(s.x(100)).toBe(110);
    expect(s.y(0)).toBe(120);
    expect(s.y(10000)).toBe(20);
  });

  it('turns a pixel back into a distance inside the plot', () => {
    expect(s.invertX(60)).toBe(50);
    expect(s.invertX(-40)).toBe(0);
    expect(s.invertX(500)).toBe(100);
  });
});

describe('ticks', () => {
  it('picks round steps', () => {
    expect(niceStep(37000, 4)).toBe(10000);
    expect(niceStep(12, 5)).toBe(2.5);
    expect(ticks(40000, 4)).toEqual([0, 10000, 20000, 30000, 40000]);
    expect(ticks(237, 5)).toEqual([0, 50, 100, 150, 200]);
  });
});

describe('paths', () => {
  const rows: Row[] = [
    { d: 0, v: 0 },
    { d: 50, v: null },
    { d: 100, v: 10000 },
  ];

  it('joins across missing values', () => {
    expect(linePath(rows, d, v, s)).toBe('M10,120L110,20');
  });

  it('closes an area to the baseline', () => {
    expect(areaPath(rows, d, v, s, 120)).toBe('M10,120L10,120L110,20L110,120Z');
  });

  it('holds each value until the next row', () => {
    const steps: Row[] = [
      { d: 0, v: 5000 },
      { d: 50, v: 10000 },
      { d: 100, v: 10000 },
    ];
    expect(stepAfterPath(steps, d, v, s)).toBe('M10,70H60V20H110V20');
  });

  it('draws nothing from fewer than two points', () => {
    expect(linePath([{ d: 0, v: 1 }], d, v, s)).toBe('');
  });
});

describe('nearestRowIndex', () => {
  const rows: Row[] = [0, 10, 20, 40].map((x) => ({ d: x, v: 0 }));
  it('finds the closest row by distance', () => {
    expect(nearestRowIndex(rows, d, -5)).toBe(0);
    expect(nearestRowIndex(rows, d, 14)).toBe(1);
    expect(nearestRowIndex(rows, d, 16)).toBe(2);
    expect(nearestRowIndex(rows, d, 31)).toBe(3);
    expect(nearestRowIndex(rows, d, 99)).toBe(3);
    expect(nearestRowIndex([], d, 1)).toBe(-1);
  });
});

describe('zoom and seek', () => {
  it('maps a zoomed stretch across the whole plot', () => {
    const z = makeScales(box, [40, 60], 10000);
    expect(z.x(40)).toBe(10);
    expect(z.x(60)).toBe(110);
    expect(z.invertX(60)).toBe(50);
    expect(z.invertX(0)).toBe(40);
  });

  it('puts round ticks inside the stretch', () => {
    expect(ticksBetween(1234, 1876, 5)).toEqual([1400, 1600, 1800]);
  });

  it('zooms around the cursor and stays inside the route', () => {
    expect(zoomDomain([0, 1000], 1000, 500, 0.5)).toEqual([250, 750]);
    expect(zoomDomain([0, 1000], 1000, 0, 0.5)).toEqual([0, 500]);
    expect(zoomDomain([0, 1000], 1000, 1000, 0.5)).toEqual([500, 1000]);
  });

  it('stops at a few miles, and back at the whole route', () => {
    expect(minSpanNm(6800)).toBe(34);
    expect(zoomDomain([100, 140], 6800, 120, 0.1)).toEqual([103, 137]);
    expect(zoomDomain([0, 900], 1000, 500, 1.25)).toBeNull();
  });

  it('pans and centres without leaving the route', () => {
    expect(panDomain([100, 200], 1000, -150)).toEqual([0, 100]);
    expect(panDomain([100, 200], 1000, 2000)).toEqual([900, 1000]);
    expect(centerDomain([100, 200], 1000, 500)).toEqual([450, 550]);
  });
});
