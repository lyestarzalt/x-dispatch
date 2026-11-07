/**
 * How this copy was installed, sent with every analytics event: tells how many
 * people still run an installer from before Velopack, which decides when the old
 * Squirrel feed can go.
 */
export type InstallKind =
  'velopack' | 'squirrel' | 'forge_dmg' | 'appimage_legacy' | 'dev' | 'other';

export function detectInstallKind(env: {
  isPackaged: boolean;
  /** Velopack located its install manifest for this copy. */
  velopack: boolean;
  platform: NodeJS.Platform;
  /** Squirrel's Update.exe sits next to the versioned app folder. */
  squirrelUpdaterExists: boolean;
  appImage: string | undefined;
}): InstallKind {
  if (!env.isPackaged) return 'dev';
  if (env.velopack) return 'velopack';
  if (env.platform === 'win32' && env.squirrelUpdaterExists) return 'squirrel';
  if (env.platform === 'darwin') return 'forge_dmg';
  if (env.platform === 'linux' && env.appImage) return 'appimage_legacy';
  return 'other';
}

export type UpdateFailureReason = 'network' | 'not_found' | 'other';

/** Coarse cause of an updater error, from Velopack's message; never the message itself. */
export function updateFailureReason(message: string): UpdateFailureReason {
  if (/\b404\b/.test(message)) return 'not_found';
  // The updater prefixes its transport failures ("Network error", "IO error"), and
  // Windows quotes a WinSock code ("os error 11001") whatever language the text is in.
  if (
    /network|io error|timed? ?out|dns|connect|unreachable|reset|peer|certificate|decrypt|lookup|host|end of file|os error \d+/i.test(
      message
    )
  ) {
    return 'network';
  }
  return 'other';
}

/** Whether a downloaded update came as deltas or a full package, and how big it was. */
export function downloadedUpdateFacts(update: {
  DeltasToTarget: { Size: number }[];
  TargetFullRelease: { Size: number };
}): { kind: 'delta' | 'full'; size_mb: number } {
  const delta = update.DeltasToTarget.length > 0;
  const bytes = delta
    ? update.DeltasToTarget.reduce((sum, d) => sum + d.Size, 0)
    : update.TargetFullRelease.Size;
  return { kind: delta ? 'delta' : 'full', size_mb: Math.min(1000, Math.ceil(bytes / 1_048_576)) };
}
