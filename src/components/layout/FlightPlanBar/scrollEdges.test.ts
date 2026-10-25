import { describe, expect, it } from 'vitest';
import { getScrollEdges, pageStep } from './scrollEdges';

describe('getScrollEdges', () => {
  it('reports both edges when the tape fits in view', () => {
    expect(getScrollEdges(0, 800, 500)).toEqual({ atStart: true, atEnd: true, overflows: false });
  });

  it('is at the start only when scrolled to the left', () => {
    expect(getScrollEdges(0, 800, 2000)).toEqual({ atStart: true, atEnd: false, overflows: true });
  });

  it('is at the end within a couple of pixels of the maximum', () => {
    expect(getScrollEdges(1199, 800, 2000)).toMatchObject({ atStart: false, atEnd: true });
  });

  it('is at neither edge in the middle', () => {
    expect(getScrollEdges(600, 800, 2000)).toMatchObject({ atStart: false, atEnd: false });
  });
});

describe('pageStep', () => {
  it('scrolls most of the visible width', () => {
    expect(pageStep(1000)).toBe(800);
  });

  it('never steps less than a chip or two on a narrow tape', () => {
    expect(pageStep(50)).toBe(120);
  });
});
