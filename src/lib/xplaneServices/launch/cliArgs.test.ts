import { describe, expect, it } from 'vitest';
import { filterReservedXpArgs } from './cliArgs';

describe('filterReservedXpArgs', () => {
  it('passes through unrelated args', () => {
    expect(filterReservedXpArgs(['--no_sound', '--lang=en'])).toEqual(['--no_sound', '--lang=en']);
  });

  it('drops bare --new_flight_json', () => {
    expect(filterReservedXpArgs(['--new_flight_json', '--no_sound'])).toEqual(['--no_sound']);
  });

  it('drops --new_flight_json=path', () => {
    expect(filterReservedXpArgs(['--new_flight_json=/tmp/evil.json'])).toEqual([]);
  });

  it('drops --new_flight_json with leading whitespace', () => {
    expect(filterReservedXpArgs([' --new_flight_json=/tmp/evil.json'])).toEqual([]);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = ['--no_sound', '--new_flight_json=/x'];
    const out = filterReservedXpArgs(input);
    expect(out).toEqual(['--no_sound']);
    expect(input).toEqual(['--no_sound', '--new_flight_json=/x']);
  });
});
