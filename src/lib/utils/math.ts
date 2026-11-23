/** `value` held inside `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** An angle in degrees brought into `[0, 360)`. */
export function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** An angle in degrees brought into `[-180, 180)`. */
export function normalize180(deg: number): number {
  return (((deg % 360) + 540) % 360) - 180;
}

/**
 * The shortest signed turn from `fromDeg` to `toDeg`, in `[-180, 180)`.
 * Works for headings and for longitudes (the short way across the antimeridian).
 */
export function signedAngleDelta(fromDeg: number, toDeg: number): number {
  return normalize180(toDeg - fromDeg);
}

/** A heading `t` of the way from `a` to `b`, turning the short way; result in `[0, 360)`. */
export function lerpHeading(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

/**
 * A smooth 0-to-1 ramp as `x` goes from `edge0` to `edge1`, flat outside. With the default
 * edges it eases a value that is already a 0-to-1 fraction.
 */
export function smoothstep(x: number, edge0 = 0, edge1 = 1): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
