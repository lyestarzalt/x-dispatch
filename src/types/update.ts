export type UpdateInstallState =
  'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error';

/** 'beta' also offers release candidates, and stable releases whenever they are newer. */
export type UpdateChannel = 'stable' | 'beta';

export interface UpdateStatus {
  channel: UpdateChannel;
  /** Newest release on the chosen channel, null until the manifests have been read. */
  latestVersion: string | null;
  /** Newest beta on the download host, read only on the beta channel. */
  latestBetaVersion: string | null;
  url: string;
  /** True when the app installs updates itself (the packaged Windows build). */
  managed: boolean;
  /** Progress of the self-installing update; stays 'idle' when not managed. */
  install: UpdateInstallState;
  /** Version that finished downloading, known once `install` is 'ready'. */
  installVersion: string | null;
  error: string | null;
}
