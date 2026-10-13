// "1.9.0", "v1.9.0", "1.9.0-rc.3" → [1, 9, 0]. Pre-release suffix is dropped.
export function parseSemverTriple(v: string): [number, number, number] {
  const [core] = v.replace(/^v/, '').split('-');
  const parts = (core ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function hasPrerelease(v: string): boolean {
  return v.replace(/^v/, '').includes('-');
}

// "1.9.0-rc.3" and Squirrel's "1.9.0-rc3" → 3.
function prereleaseNumber(v: string): number {
  const match = /-[a-z]*\.?(\d+)/i.exec(v);
  return parseInt(match?.[1] ?? '0', 10);
}

export function isNewerVersion(current: string, latest: string): boolean {
  const [ca, cb, cc] = parseSemverTriple(current);
  const [la, lb, lc] = parseSemverTriple(latest);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  if (lc !== cc) return lc > cc;
  // Same triple: per semver, stable > prerelease. So nudge an RC user to stable.
  if (!hasPrerelease(current) || !hasPrerelease(latest)) {
    return hasPrerelease(current) && !hasPrerelease(latest);
  }
  return prereleaseNumber(latest) > prereleaseNumber(current);
}

// "2.5.1-rc.1" and Squirrel's "2.5.1-rc1" → "2.5.1 Beta 1"; pilots never see "rc".
export function displayVersion(v: string, betaLabel: string): string {
  return v.replace(/^v/, '').replace(/-rc\.?(\d+)$/, ` ${betaLabel} $1`);
}
