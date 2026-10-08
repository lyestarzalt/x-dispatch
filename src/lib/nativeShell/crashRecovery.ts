/** A second crash inside this window means reloading is not fixing it. */
export const CRASH_LOOP_WINDOW_MS = 60_000;

export type CrashDecision = 'reload' | 'ask';

/** Reload a crashed renderer once; ask the user instead of looping when it keeps crashing. */
export function createCrashRecovery() {
  let lastCrashAt: number | null = null;
  return {
    onCrash(now: number): CrashDecision {
      const recent = lastCrashAt !== null && now - lastCrashAt < CRASH_LOOP_WINDOW_MS;
      lastCrashAt = now;
      return recent ? 'ask' : 'reload';
    },
  };
}
