import { describe, expect, it } from 'vitest';
import { RESERVED_XP_ARG, filterReservedXpArgs } from './cliArgs';

const reserved = RESERVED_XP_ARG;

describe('filterReservedXpArgs', () => {
  it('passes through unrelated args', () => {
    expect(filterReservedXpArgs(['--no_sound', '--lang=en'])).toEqual(['--no_sound', '--lang=en']);
  });

  it('drops the reserved flag (bare form)', () => {
    expect(filterReservedXpArgs([reserved, '--no_sound'])).toEqual(['--no_sound']);
  });

  it('drops the reserved flag with =value', () => {
    expect(filterReservedXpArgs([`${reserved}=/tmp/evil.json`])).toEqual([]);
  });

  it('drops the reserved flag with leading whitespace', () => {
    expect(filterReservedXpArgs([` ${reserved}=/tmp/evil.json`])).toEqual([]);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = ['--no_sound', `${reserved}=/x`];
    const out = filterReservedXpArgs(input);
    expect(out).toEqual(['--no_sound']);
    expect(input).toEqual(['--no_sound', `${reserved}=/x`]);
  });
});
