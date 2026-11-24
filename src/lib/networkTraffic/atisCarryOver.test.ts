import { describe, expect, it } from 'vitest';
import type { VatsimATIS } from '@/types/vatsim';
import { ATIS_GAP_GRACE_MS, type AtisMemory, carryOverAtis } from './atisCarryOver';

const atis = (callsign: string, code: string | null, text: string[] | null): VatsimATIS => ({
  cid: 1,
  name: '',
  callsign,
  frequency: '128.725',
  facility: 4,
  rating: 5,
  server: '',
  visual_range: 0,
  atis_code: code as string,
  text_atis: text,
  last_updated: '',
  logon_time: '',
});

const A_TEXT = ['OMDB ARR INFO A. LANDING RWY 30L.'];
const D_TEXT = ['OMDB DEP INFO D. DEPARTURE RWY 30R.'];

/** Feeds polls through the carry-over, returning what each poll shows. */
function run(polls: { at: number; atis: VatsimATIS[] }[]) {
  let memory: AtisMemory = new Map();
  return polls.map(({ at, atis: list }) => {
    const out = carryOverAtis(memory, list, at);
    memory = out.memory;
    return out.atis.map((a) => `${a.callsign}:${a.atis_code ?? '-'}:${a.text_atis?.length ?? 0}`);
  });
}

describe('carryOverAtis', () => {
  // GitHub #415, and the VATSIM feed recorded on 2026-11-24: YSSY_ATIS went missing for a poll,
  // came back with no text and no letter, then with its new letter a minute later.
  it('keeps the last ATIS through a missed poll and an empty reconnect', () => {
    const shown = run([
      { at: 0, atis: [atis('OMDB_A_ATIS', 'A', A_TEXT), atis('OMDB_D_ATIS', 'D', D_TEXT)] },
      { at: 15_000, atis: [atis('OMDB_D_ATIS', 'D', D_TEXT)] },
      { at: 30_000, atis: [atis('OMDB_A_ATIS', null, null), atis('OMDB_D_ATIS', 'D', D_TEXT)] },
      { at: 60_000, atis: [atis('OMDB_A_ATIS', 'B', A_TEXT), atis('OMDB_D_ATIS', 'D', D_TEXT)] },
    ]);
    expect(shown).toEqual([
      ['OMDB_A_ATIS:A:1', 'OMDB_D_ATIS:D:1'],
      ['OMDB_D_ATIS:D:1', 'OMDB_A_ATIS:A:1'],
      ['OMDB_A_ATIS:A:1', 'OMDB_D_ATIS:D:1'],
      ['OMDB_A_ATIS:B:1', 'OMDB_D_ATIS:D:1'],
    ]);
  });

  it('lets an ATIS go once it has been gone longer than the grace period', () => {
    const shown = run([
      { at: 0, atis: [atis('OMDB_A_ATIS', 'A', A_TEXT)] },
      { at: ATIS_GAP_GRACE_MS, atis: [] },
      { at: ATIS_GAP_GRACE_MS + 15_000, atis: [] },
    ]);
    expect(shown).toEqual([['OMDB_A_ATIS:A:1'], ['OMDB_A_ATIS:A:1'], []]);
  });

  it('shows an ATIS that never had text as it is', () => {
    expect(run([{ at: 0, atis: [atis('KHIO_ATIS', '', [])] }])).toEqual([['KHIO_ATIS::0']]);
  });
});
