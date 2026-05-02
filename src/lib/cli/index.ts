import { buildHelpText, buildVersionText } from './help';
import type { CliParseResult } from './parser';
import { parseArgv } from './parser';
import { setCliFlags } from './state';

export type { CliFlags } from '@/types/cli';
export type { CliParseResult, UnknownFlag } from './parser';
export { getCliFlags } from './state';

/**
 * Parse argv and store the result in the singleton state.
 * Returns the parse result so callers can act on `unknownWithSuggestions`.
 */
export function parseAndApply(argv: string[]): CliParseResult {
  const result = parseArgv(argv);
  setCliFlags(result.flags);
  return result;
}

/**
 * Print help text to stdout and exit with code 0.
 * Wrapped in try/catch in case stdout is closed (broken pipe).
 */
export function printHelpAndExit(version: string): never {
  try {
    process.stdout.write(buildHelpText(version));
  } catch {
    // stdout closed — exit anyway
  }
  process.exit(0);
}

/**
 * Print version to stdout and exit with code 0.
 */
export function printVersionAndExit(version: string): never {
  try {
    process.stdout.write(buildVersionText(version));
  } catch {
    // stdout closed — exit anyway
  }
  process.exit(0);
}
