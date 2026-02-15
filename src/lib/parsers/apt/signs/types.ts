/**
 * X-Plane Sign Renderer Types
 *
 * Based on X-Plane Taxi-Sign Specification:
 * https://developer.x-plane.com/article/taxi-sign-specification/
 */

/** Color directive modes from apt.dat spec */
export type SignColorMode = 'Y' | 'R' | 'L' | 'B';

/** A single segment of a sign with its color mode and text */
export interface SignSegment {
  type: SignColorMode;
  text: string;
}

/** Parsed sign with front segments (and optional back) */
export interface ParsedSign {
  front: SignSegment[];
  back: SignSegment[];
}

/** Color configuration for a sign mode */
export interface SignColorConfig {
  bg: string;
  text: string;
  border: string;
}

/** Full sign renderer configuration */
export interface SignConfig {
  scale: number;
  baseFontSize: number;
  basePadding: number;
  baseBorderWidth: number;
  baseCharWidth: number;
  sizeMultipliers: Record<number, number>;
  colors: Record<SignColorMode, SignColorConfig>;
}

/** Computed dimensions for rendering */
export interface SignDimensions {
  fontSize: number;
  padding: number;
  borderWidth: number;
  charWidth: number;
  height: number;
}
