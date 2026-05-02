import type { CliFlags } from '@/types/cli';

const EMPTY: Readonly<CliFlags> = Object.freeze({
  help: false,
  version: false,
  resetCache: false,
  xpArgs: Object.freeze([] as string[]) as string[],
});

let current: Readonly<CliFlags> = EMPTY;
let isSet = false;

export function setCliFlags(flags: CliFlags): void {
  if (isSet) {
    throw new Error('CLI flags already set; cannot reassign');
  }
  current = Object.freeze({
    help: flags.help,
    version: flags.version,
    resetCache: flags.resetCache,
    xpArgs: Object.freeze([...flags.xpArgs]) as string[],
  });
  isSet = true;
}

export function getCliFlags(): Readonly<CliFlags> {
  return current;
}

/** Test-only — never call in production code. */
export function __resetCliFlagsForTest(): void {
  current = EMPTY;
  isSet = false;
}
