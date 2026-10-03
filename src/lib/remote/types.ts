/** Shared between main, the settings UI and the browser bridge. */
export interface RemoteClientInfo {
  id: string;
  ip: string;
  userAgent: string;
  connectedAt: string;
}

export interface RemoteAccessStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  token: string;
  /** One pairing URL per LAN address. */
  urls: string[];
  clients: RemoteClientInfo[];
  error?: string;
}
