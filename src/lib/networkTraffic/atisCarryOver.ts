import type { VatsimATIS } from '@/types/vatsim';

/**
 * How long an ATIS that drops out of the VATSIM feed, or comes back without text, keeps its last
 * broadcast. Recorded 2026-11-24: stations missed single 15 s polls and reconnected blank for 30 to
 * 60 s before their text returned, which blanked the airport card's runways (GitHub #415).
 */
export const ATIS_GAP_GRACE_MS = 120_000;

/** The last ATIS with text seen for each callsign, and when. */
export type AtisMemory = ReadonlyMap<string, { atis: VatsimATIS; seenAt: number }>;

const hasText = (a: VatsimATIS) => (a.text_atis?.length ?? 0) > 0;

/**
 * The poll's ATIS list with short gaps bridged: a station missing from this poll, or listed
 * without text, shows its last broadcast for up to `ATIS_GAP_GRACE_MS`. A new broadcast replaces
 * it as soon as it arrives.
 */
export function carryOverAtis(
  memory: AtisMemory,
  current: readonly VatsimATIS[],
  now: number
): { atis: VatsimATIS[]; memory: AtisMemory } {
  const next = new Map<string, { atis: VatsimATIS; seenAt: number }>();
  const recent = (callsign: string) => {
    const kept = memory.get(callsign);
    return kept && now - kept.seenAt <= ATIS_GAP_GRACE_MS ? kept : undefined;
  };
  const out: VatsimATIS[] = [];
  const listed = new Set<string>();
  for (const a of current) {
    listed.add(a.callsign);
    if (hasText(a)) {
      next.set(a.callsign, { atis: a, seenAt: now });
      out.push(a);
      continue;
    }
    const kept = recent(a.callsign);
    if (kept) {
      next.set(a.callsign, kept);
      out.push(kept.atis);
    } else {
      out.push(a);
    }
  }
  for (const [callsign] of memory) {
    if (listed.has(callsign)) continue;
    const kept = recent(callsign);
    if (!kept) continue;
    next.set(callsign, kept);
    out.push(kept.atis);
  }
  return { atis: out, memory: next };
}
