import { describe, expect, it } from 'vitest';
import { parseArgv } from './parser';

const NODE = '/usr/local/bin/node';

describe('parseArgv — boolean flags', () => {
  it('returns all defaults for empty argv (just executable)', () => {
    const result = parseArgv([NODE]);
    expect(result.flags).toEqual({
      help: false,
      version: false,
      resetCache: false,
      xpArgs: [],
    });
    expect(result.unknownWithSuggestions).toEqual([]);
  });

  it('sets resetCache for --reset-cache', () => {
    const result = parseArgv([NODE, '--reset-cache']);
    expect(result.flags.resetCache).toBe(true);
  });

  it('is idempotent for repeated --reset-cache', () => {
    const result = parseArgv([NODE, '--reset-cache', '--reset-cache']);
    expect(result.flags.resetCache).toBe(true);
    expect(result.unknownWithSuggestions).toEqual([]);
  });

  it('sets help for --help and -h', () => {
    expect(parseArgv([NODE, '--help']).flags.help).toBe(true);
    expect(parseArgv([NODE, '-h']).flags.help).toBe(true);
  });

  it('sets version for --version and -v', () => {
    expect(parseArgv([NODE, '--version']).flags.version).toBe(true);
    expect(parseArgv([NODE, '-v']).flags.version).toBe(true);
  });
});

describe('parseArgv — --xp-arg', () => {
  it('captures a single --xp-arg= value', () => {
    const result = parseArgv([NODE, '--xp-arg=--no_sprites']);
    expect(result.flags.xpArgs).toEqual(['--no_sprites']);
  });

  it('captures multiple --xp-arg= values in order', () => {
    const result = parseArgv([NODE, '--xp-arg=--fps_test=2', '--xp-arg=--no_pixel_counters']);
    expect(result.flags.xpArgs).toEqual(['--fps_test=2', '--no_pixel_counters']);
  });

  it('drops empty --xp-arg= silently (no unknowns, no values)', () => {
    const result = parseArgv([NODE, '--xp-arg=']);
    expect(result.flags.xpArgs).toEqual([]);
    expect(result.unknownWithSuggestions).toEqual([]);
  });

  it('captures the dumb security case (--xp-arg=--new_flight_json=foo)', () => {
    // Parser is intentionally dumb. Filtering happens in the launcher.
    const result = parseArgv([NODE, '--xp-arg=--new_flight_json=foo']);
    expect(result.flags.xpArgs).toEqual(['--new_flight_json=foo']);
  });
});

describe('parseArgv — unknown and ignored flags', () => {
  it('reports an unknown flag with no suggestion when nothing is close', () => {
    const result = parseArgv([NODE, '--something-totally-different']);
    expect(result.unknownWithSuggestions).toEqual([
      { flag: '--something-totally-different', suggestion: undefined },
    ]);
  });

  it('suggests --reset-cache for --rest-cache typo', () => {
    const result = parseArgv([NODE, '--rest-cache']);
    expect(result.unknownWithSuggestions).toEqual([
      { flag: '--rest-cache', suggestion: '--reset-cache' },
    ]);
  });

  it('suggests --xp-arg for --xp-args (extra letter)', () => {
    const result = parseArgv([NODE, '--xp-args']);
    expect(result.unknownWithSuggestions[0]?.suggestion).toBe('--xp-arg');
  });

  it('does not warn about Electron debug flags (silent passthrough)', () => {
    const result = parseArgv([NODE, '--inspect=9229', '--remote-debugging-port=9222']);
    expect(result.unknownWithSuggestions).toEqual([]);
  });

  it('strips =value before suggesting (--rest-cache=foo still suggests --reset-cache)', () => {
    const result = parseArgv([NODE, '--rest-cache=foo']);
    expect(result.unknownWithSuggestions[0]?.flag).toBe('--rest-cache');
    expect(result.unknownWithSuggestions[0]?.suggestion).toBe('--reset-cache');
  });
});

describe('parseArgv — non-flag tokens and mixed scenarios', () => {
  it('ignores non-flag tokens (paths, names) silently', () => {
    const result = parseArgv([NODE, '/Users/me/some/path.json', 'random-token', '--reset-cache']);
    expect(result.flags.resetCache).toBe(true);
    expect(result.unknownWithSuggestions).toEqual([]);
  });

  it('handles a mixed argv (reset, xp-arg, electron flag, unknown)', () => {
    const result = parseArgv([
      NODE,
      '--reset-cache',
      '--xp-arg=--no_sound',
      '--inspect=9229',
      '--typo',
    ]);
    expect(result.flags.resetCache).toBe(true);
    expect(result.flags.xpArgs).toEqual(['--no_sound']);
    expect(result.unknownWithSuggestions.map((u) => u.flag)).toEqual(['--typo']);
  });

  it('treats --xp-arg without = as unknown with suggestion --xp-arg', () => {
    const result = parseArgv([NODE, '--xp-arg']);
    expect(result.flags.xpArgs).toEqual([]);
    expect(result.unknownWithSuggestions[0]?.flag).toBe('--xp-arg');
    expect(result.unknownWithSuggestions[0]?.suggestion).toBe('--xp-arg');
  });
});
