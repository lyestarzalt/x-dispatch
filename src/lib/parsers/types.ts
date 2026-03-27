export interface ParseResult<T> {
  data: T;
  errors: ParseError[];
  stats: { total: number; parsed: number; skipped: number; timeMs?: number };
}

export interface ParseError {
  line?: number;
  path?: string;
  message: string;
}

/**
 * Type guard that narrows a string array to a tuple with at least N defined elements.
 * Use after splitting a line to ensure indexed access is safe.
 */
export function hasMinLength<N extends number>(
  arr: string[],
  min: N
): arr is string[] & { [K in NumbersUpTo<N>]: string } {
  return arr.length >= min;
}

// Helper type: produces a union of numeric literal indices 0..N-1
type NumbersUpTo<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : NumbersUpTo<N, [...Acc, Acc['length']]>;
