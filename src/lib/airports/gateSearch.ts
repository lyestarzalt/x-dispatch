import type { StartupLocation } from '@/types/apt';

/**
 * Indices of the gates a search text matches: by name, by airline code, or by any extra
 * word the caller shows for the gate (its size and operation labels, in the user's language).
 * An empty query matches every gate.
 */
export function matchGateIndices(
  gates: readonly StartupLocation[],
  query: string,
  shownLabels: (gate: StartupLocation) => readonly string[] = () => []
): number[] {
  const needle = query.trim().toLowerCase();
  const matches: number[] = [];
  gates.forEach((gate, index) => {
    if (
      !needle ||
      gate.name.toLowerCase().includes(needle) ||
      shownLabels(gate).some((label) => label.toLowerCase().includes(needle)) ||
      gate.airlines?.some((airline) => airline.toLowerCase().includes(needle))
    ) {
      matches.push(index);
    }
  });
  return matches;
}
