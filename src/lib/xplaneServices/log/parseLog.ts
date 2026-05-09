/**
 * Parses an X-Plane Log.txt and returns three views:
 *   - recognized: lines matching one of our catalogued patterns (with a glossed UI treatment)
 *   - otherIssues: any E/W line that is neither recognized nor in our noise filter (raw, no gloss)
 *   - lineCount: total lines in the input (handy for the "showing N lines" banner)
 *
 * X-Plane log line shape (verified against XP 12.4.2):
 *   H:MM:SS.SSS LEVEL/CATEGORY: <message>
 * Level is I/W/E. Pre-runtime header lines (banner, build, OS, command line) don't follow the
 * shape and are skipped.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface RecognizedPattern {
  id: string;
  regex: RegExp;
  level: LogLevel;
}

export interface ExcludedPattern {
  id: string;
  regex: RegExp;
}

export interface RecognizedMatch {
  id: string;
  level: LogLevel;
  lineNumber: number;
  line: string;
}

export interface OtherIssue {
  level: 'warn' | 'error';
  category: string;
  lineNumber: number;
  line: string;
}

export interface ParseResult {
  recognized: RecognizedMatch[];
  otherIssues: OtherIssue[];
  lineCount: number;
}

// Verified against a real XP 12.4.2 log. Add new entries only after seeing them in
// a real log — see docs/superpowers/specs/2026-05-09-xp-log-viewer-design.md.
export const RECOGNIZED_PATTERNS: RecognizedPattern[] = [
  {
    id: 'flt-init-ok',
    regex: /^\d+:\d+:\d+\.\d+ I\/FLT: Init dat_p\d+ type:'(ramp_start|runway_start|lle_[a-z_]+)'/,
    level: 'info',
  },
];

// Noise filter — verified frequent E/W lines that are not actionable from the user's side.
export const EXCLUDED_PATTERNS: ExcludedPattern[] = [
  {
    id: 'apt-lost-controllers',
    regex: /E\/APT: The airport .* has lost some controllers due to bad frequencies/,
  },
  {
    id: 'apt-override-warning',
    regex: /W\/APT: WARNING: airport .* overrides code .* but it has already been overridden/,
  },
  {
    id: 'net-analytics-failed',
    regex: /E\/NET: Download failed.*lookup\.x-plane\.com.*analytics/,
  },
];

const EW_PREFIX = /^\d+:\d+:\d+\.\d+ ([EW])\/([A-Z][A-Za-z]*(?:\/[A-Za-z]+)*): /;

export function parseLog(text: string): ParseResult {
  const lines = text.split('\n');
  const recognized: RecognizedMatch[] = [];
  const otherIssues: OtherIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1;

    // Recognized first — a line that matches a catalogued pattern goes there and never to "other".
    let matchedRecognized = false;
    for (const p of RECOGNIZED_PATTERNS) {
      if (p.regex.test(line)) {
        recognized.push({ id: p.id, level: p.level, lineNumber, line });
        matchedRecognized = true;
      }
    }
    if (matchedRecognized) continue;

    // Otherwise, look for the standard E/W shape and run it through the noise filter.
    const m = line.match(EW_PREFIX);
    if (!m) continue;

    const isExcluded = EXCLUDED_PATTERNS.some((p) => p.regex.test(line));
    if (isExcluded) continue;

    otherIssues.push({
      level: m[1] === 'E' ? 'error' : 'warn',
      // Top-level category only — XP nests like W/GFX/MTL: ...; we show GFX in the badge.
      category: (m[2] ?? '').split('/')[0] ?? '',
      lineNumber,
      line,
    });
  }

  return { recognized, otherIssues, lineCount: lines.length };
}
