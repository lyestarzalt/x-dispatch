/** Livery thumbnail width the pilot picks with the size slider, in CSS pixels. */
export const LIVERY_THUMB_WIDTH = { min: 120, max: 320, step: 20, default: 200 } as const;

/** Gap between thumbnails and padding around the grid, in CSS pixels. */
export const LIVERY_GAP = 12;
export const LIVERY_PADDING = 12;

const LABEL_HEIGHT = 28;
const VISIBLE_ROWS = 2;

/** A stored width brought back into the slider's range and onto its steps. */
export function clampLiveryThumbWidth(width: unknown): number {
  const { min, max, step, default: fallback } = LIVERY_THUMB_WIDTH;
  if (typeof width !== 'number' || !Number.isFinite(width)) return fallback;
  const stepped = Math.round(width / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

/** Height of one thumbnail card: a 16:9 picture at the chosen width, plus the name under it. */
export function liveryCardHeight(thumbWidth: number): number {
  return Math.round((thumbWidth * 9) / 16) + LABEL_HEIGHT;
}

/** Height of the grid when it shows two full rows; more liveries scroll. */
export function liveryGridHeight(thumbWidth: number): number {
  return (
    liveryCardHeight(thumbWidth) * VISIBLE_ROWS +
    LIVERY_GAP * (VISIBLE_ROWS - 1) +
    LIVERY_PADDING * 2
  );
}
