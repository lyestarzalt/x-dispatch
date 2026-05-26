// "1.9.0", "v1.9.0", "1.9.0-rc.3" → [1, 9, 0]. Pre-release suffix is dropped.
export function parseSemverTriple(v: string): [number, number, number] {
  const [core] = v.replace(/^v/, '').split('-');
  const parts = (core ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function hasPrerelease(v: string): boolean {
  return v.replace(/^v/, '').includes('-');
}

export function isNewerVersion(current: string, latest: string): boolean {
  const [ca, cb, cc] = parseSemverTriple(current);
  const [la, lb, lc] = parseSemverTriple(latest);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  if (lc !== cc) return lc > cc;
  // Same triple: per semver, stable > prerelease. So nudge an RC user to stable.
  return hasPrerelease(current) && !hasPrerelease(latest);
}
