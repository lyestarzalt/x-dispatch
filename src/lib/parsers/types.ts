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
