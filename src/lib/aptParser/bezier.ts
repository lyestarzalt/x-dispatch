const DEFAULT_BEZIER_RESOLUTION = 60;

export function quadraticBezier(t: number, p0: number, p1: number, p2: number): number {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

export function calculateBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  resolution = DEFAULT_BEZIER_RESOLUTION
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= resolution; i++) {
    const t = i / resolution;
    points.push([quadraticBezier(t, p0[0], p1[0], p2[0]), quadraticBezier(t, p0[1], p1[1], p2[1])]);
  }
  return points;
}
