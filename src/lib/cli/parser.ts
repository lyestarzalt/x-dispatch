// src/lib/cli/parser.ts
import type { CliFlags } from '@/types/cli';
import { isIgnoredFlag } from './ignoreList';

export interface UnknownFlag {
  flag: string;
  suggestion?: string;
}

export interface CliParseResult {
  flags: CliFlags;
  unknownWithSuggestions: UnknownFlag[];
}

const KNOWN_FLAGS: readonly string[] = [
  '--help',
  '-h',
  '--version',
  '-v',
  '--reset-cache',
  '--xp-arg',
];

export function parseArgv(argv: string[]): CliParseResult {
  const flags: CliFlags = {
    help: false,
    version: false,
    resetCache: false,
    xpArgs: [],
  };
  const unknownWithSuggestions: UnknownFlag[] = [];

  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;

    if (token === '--help' || token === '-h') {
      flags.help = true;
      continue;
    }
    if (token === '--version' || token === '-v') {
      flags.version = true;
      continue;
    }
    if (token === '--reset-cache') {
      flags.resetCache = true;
      continue;
    }
    if (token.startsWith('--xp-arg=')) {
      const value = token.slice('--xp-arg='.length);
      if (value) flags.xpArgs.push(value);
      continue;
    }

    if (!token.startsWith('--') && !token.startsWith('-')) continue;

    if (isIgnoredFlag(token)) continue;

    const flagOnly = token.split('=')[0] ?? token;
    unknownWithSuggestions.push({
      flag: flagOnly,
      suggestion: nearestKnownFlag(flagOnly),
    });
  }

  return { flags, unknownWithSuggestions };
}

function nearestKnownFlag(input: string): string | undefined {
  let best: { flag: string; dist: number } | null = null;
  for (const known of KNOWN_FLAGS) {
    const dist = levenshtein(input, known);
    if (dist <= 2 && (best === null || dist < best.dist)) {
      best = { flag: known, dist };
    }
  }
  return best?.flag;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Int32Array(n + 1);
  let curr = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}
