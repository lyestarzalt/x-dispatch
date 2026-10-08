import { describe, expect, it } from 'vitest';
import { CRASH_LOOP_WINDOW_MS, createCrashRecovery } from './crashRecovery';

describe('createCrashRecovery', () => {
  it('reloads silently on the first crash', () => {
    const recovery = createCrashRecovery();
    expect(recovery.onCrash(1_000)).toBe('reload');
  });

  it('asks the user when the renderer crashes again within the window', () => {
    const recovery = createCrashRecovery();
    recovery.onCrash(1_000);
    expect(recovery.onCrash(1_000 + CRASH_LOOP_WINDOW_MS - 1)).toBe('ask');
  });

  it('reloads silently again once the window has passed', () => {
    const recovery = createCrashRecovery();
    recovery.onCrash(1_000);
    expect(recovery.onCrash(1_000 + CRASH_LOOP_WINDOW_MS)).toBe('reload');
  });

  it('keeps asking while crashes keep coming close together', () => {
    const recovery = createCrashRecovery();
    recovery.onCrash(0);
    expect(recovery.onCrash(10_000)).toBe('ask');
    expect(recovery.onCrash(20_000)).toBe('ask');
  });
});
