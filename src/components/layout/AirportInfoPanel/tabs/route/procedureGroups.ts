import type { ResolvedProcedure as Procedure } from '@/types/navigation';

export interface GroupedProcedure {
  name: string;
  /** One per runway and transition pairing the procedure is published for. */
  variants: Procedure[];
}

/** The procedures by name, in the order they first appear. */
export function groupProcedures(procedures: Procedure[]): GroupedProcedure[] {
  const groups = new Map<string, Procedure[]>();
  for (const proc of procedures) {
    const variants = groups.get(proc.name);
    if (variants) variants.push(proc);
    else groups.set(proc.name, [proc]);
  }
  return Array.from(groups, ([name, variants]) => ({ name, variants }));
}

/**
 * How many transitions and runways a procedure's variants cover. A STAR with six transitions
 * into two runways has twelve variants, but it is still six transitions (GitHub #402).
 */
export function variantSpread(variants: Procedure[]): { transitions: number; runways: number } {
  const distinct = (values: (string | null | undefined)[]) => new Set(values.filter(Boolean)).size;
  return {
    transitions: distinct(variants.map((v) => v.transition)),
    runways: distinct(variants.map((v) => v.runway)),
  };
}
