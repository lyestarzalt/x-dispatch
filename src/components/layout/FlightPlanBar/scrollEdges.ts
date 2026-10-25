/** Pixel slack before a scroll position counts as "at the edge". */
const EDGE_SLACK = 2;

export interface ScrollEdges {
  atStart: boolean;
  atEnd: boolean;
  /** False when the tape fits: nothing to scroll, both edges at once. */
  overflows: boolean;
}

/** Which ends of a horizontal scroller are reached, from its scroll metrics. */
export function getScrollEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number
): ScrollEdges {
  const maxLeft = Math.max(0, scrollWidth - clientWidth);
  return {
    atStart: scrollLeft <= EDGE_SLACK,
    atEnd: scrollLeft >= maxLeft - EDGE_SLACK,
    overflows: maxLeft > EDGE_SLACK,
  };
}

/** One page of chips, leaving a sliver of the previous page for continuity. */
export function pageStep(clientWidth: number): number {
  return Math.max(120, Math.round(clientWidth * 0.8));
}
