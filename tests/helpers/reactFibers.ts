/**
 * Counts mounted component instances by display name by walking React's fiber
 * tree from a container element. Lets a test assert how much a component
 * mounts (for example, that a closed select does not mount its options) without
 * timing-based profiling.
 */
type Fiber = {
  type: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
};

function nameOf(type: unknown): string | null {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? null;
  }
  if (typeof type === 'object' && type !== null) {
    const wrapped = type as { displayName?: string; render?: unknown; type?: unknown };
    if (wrapped.displayName) return wrapped.displayName;
    if (wrapped.render) return nameOf(wrapped.render);
    if (wrapped.type) return nameOf(wrapped.type);
  }
  return null;
}

export function countMountedComponents(container: Element, displayName: string): number {
  const key = Object.keys(container).find((k) => k.startsWith('__reactContainer$'));
  if (!key) throw new Error('No React root mounted on this container');
  const root = (container as unknown as Record<string, Fiber | undefined>)[key];
  if (!root) throw new Error('No React root mounted on this container');
  let count = 0;
  const stack: Fiber[] = [root];
  for (let fiber = stack.pop(); fiber; fiber = stack.pop()) {
    if (nameOf(fiber.type) === displayName) count++;
    for (let child = fiber.child; child; child = child.sibling) stack.push(child);
  }
  return count;
}
