export type UpdateInstallState =
  'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error';

export interface UpdateStatus {
  /** Newest stable release on the download host, null until the manifest has been read. */
  latestVersion: string | null;
  url: string;
  /** True when the app installs updates itself (the packaged Windows build). */
  managed: boolean;
  /** Progress of the self-installing update; stays 'idle' when not managed. */
  install: UpdateInstallState;
  /** Version that finished downloading, known once `install` is 'ready'. */
  installVersion: string | null;
  error: string | null;
}
