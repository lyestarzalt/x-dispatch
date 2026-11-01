/** One environment variable the pilot wants set for X-Plane, for example a driver switch on Linux. */
export interface LaunchEnvVar {
  name: string;
  value: string;
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidEnvName(name: string): boolean {
  return ENV_NAME.test(name);
}

/**
 * Settings and IPC input is untrusted: keep well-formed entries, drop the rest.
 * A later duplicate of a name wins, as it would on a shell command line.
 */
export function parseLaunchEnv(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(input)) return out;
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { name, value } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof value !== 'string') continue;
    const trimmed = name.trim();
    if (!isValidEnvName(trimmed)) continue;
    out[trimmed] = value;
  }
  return out;
}

/** The environment X-Plane starts with: ours, with the pilot's variables on top. */
export function buildLaunchEnv(
  base: NodeJS.ProcessEnv,
  custom: Record<string, string>
): NodeJS.ProcessEnv {
  return { ...base, ...custom };
}
