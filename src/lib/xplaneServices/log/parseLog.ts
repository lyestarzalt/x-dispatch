/**
 * Parses an X-Plane Log.txt into a header block + structured runtime entries.
 *
 * X-Plane log line shape (verified against XP 12.4.2):
 *   H:MM:SS.SSS LEVEL/CATEGORY: <message>
 *
 * Level is I (info), W (warn), E (error). Categories sometimes nest like
 * `GFX/MTL` — we surface only the top segment in `category` so the badge stays
 * compact, but `raw` keeps the full original line.
 *
 * Pre-runtime lines (build banner, OS info, command-line dump) appear before
 * the first timestamped line and don't follow the shape; they get collected
 * into `header` as raw strings so the UI can show them in their own group.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  category: string;
  message: string;
  lineNumber: number;
  raw: string;
}

export interface ParseResult {
  header: string[];
  entries: LogEntry[];
  lineCount: number;
}

const LINE_RE = /^(\d+:\d+:\d+\.\d+) ([IWE])\/([A-Z][A-Za-z]*(?:\/[A-Za-z]+)*): (.*)$/;

export function parseLog(text: string): ParseResult {
  const lines = text.split('\n');
  const header: string[] = [];
  const entries: LogEntry[] = [];
  let runtimeStarted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = line.match(LINE_RE);
    if (!m) {
      if (!runtimeStarted && line.trim() !== '') header.push(line);
      continue;
    }
    runtimeStarted = true;
    const [, timestamp, letter, category, message] = m;
    const level: LogLevel = letter === 'E' ? 'error' : letter === 'W' ? 'warn' : 'info';
    entries.push({
      level,
      timestamp: timestamp ?? '',
      category: (category ?? '').split('/')[0] ?? '',
      message: message ?? '',
      lineNumber: i + 1,
      raw: line,
    });
  }

  return { header, entries, lineCount: lines.length };
}
