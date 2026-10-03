/**
 * Tablet access: lifecycle of the LAN server and the desktop-only admin
 * channels the Settings section uses.
 */
import * as os from 'os';
import logger from '@/lib/utils/logger';
import {
  getRemoteAccessConfig,
  newRemoteToken,
  setRemoteAccessConfig,
} from '@/lib/xplaneServices/dataService/config';
import { broadcast, handle, setRemoteBroadcaster } from './handlerRegistry';
import { parsePort } from './port';
import { RemoteServer, type RemoteServerOptions } from './server';
import { createDevProxyHandler, createStaticHandler } from './staticRoute';
import type { RemoteAccessStatus } from './types';

export interface RemoteAccessDeps {
  /** Built renderer directory in production. */
  rendererDir: string;
  /** Vite dev server URL in development, undefined when packaged. */
  devServerUrl: string | undefined;
  fetchTile: RemoteServerOptions['fetchTile'];
  /** Called when a tablet goes away so main-side subscriptions are dropped. */
  onClientDisconnected: (clientId: string) => void;
  analytics: {
    track: (
      event: 'tablet_access_toggled' | 'tablet_connected',
      props: Record<string, unknown>
    ) => void;
    recordTabletClients: (count: number) => void;
  };
}

let server: RemoteServer | null = null;
let deps: RemoteAccessDeps | null = null;
let lastError: string | undefined;

export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

export function getRemoteStatus(): RemoteAccessStatus {
  const config = getRemoteAccessConfig();
  const running = server?.isRunning() ?? false;
  return {
    enabled: config.enabled,
    running,
    port: config.port,
    token: config.token,
    urls: running
      ? lanAddresses().map((ip) => `http://${ip}:${config.port}/?token=${config.token}`)
      : [],
    clients: server?.clients() ?? [],
    error: lastError,
  };
}

function publishStatus(): void {
  broadcast('remote:statusChanged', getRemoteStatus());
}

async function startServer(): Promise<void> {
  if (!deps || server) return;
  const config = setRemoteAccessConfig({});
  const instance = new RemoteServer({
    getToken: () => getRemoteAccessConfig().token,
    servePage: deps.devServerUrl
      ? createDevProxyHandler(deps.devServerUrl)
      : createStaticHandler(deps.rendererDir),
    fetchTile: deps.fetchTile,
    onClientsChanged: (clients) => {
      deps?.analytics.recordTabletClients(clients.length);
      publishStatus();
    },
    onClientConnected: (clients) =>
      deps?.analytics.track('tablet_connected', { devices: clients.length }),
    onClientDisconnected: deps.onClientDisconnected,
    log: { info: (m) => logger.main.info(m), warn: (m) => logger.main.warn(m) },
  });
  try {
    await instance.start(config.port);
    server = instance;
    lastError = undefined;
    setRemoteBroadcaster((channel, ...args) => instance.broadcast(channel, ...args));
  } catch (err) {
    lastError = (err as Error).message;
    logger.main.warn(`Tablet access server failed to start: ${lastError}`);
  }
}

export async function stopRemoteAccess(): Promise<void> {
  const instance = server;
  server = null;
  setRemoteBroadcaster(null);
  await instance?.stop();
}

export async function setRemoteEnabled(enabled: boolean): Promise<RemoteAccessStatus> {
  if (getRemoteAccessConfig().enabled !== enabled) {
    deps?.analytics.track('tablet_access_toggled', { enabled });
  }
  setRemoteAccessConfig({ enabled });
  if (enabled) await startServer();
  else await stopRemoteAccess();
  publishStatus();
  return getRemoteStatus();
}

export function initRemoteAccess(d: RemoteAccessDeps): void {
  deps = d;
  handle('remote:getStatus', () => getRemoteStatus());
  handle('remote:setEnabled', (_e, enabled: boolean) => setRemoteEnabled(enabled === true));
  handle('remote:resetToken', () => {
    setRemoteAccessConfig({ token: newRemoteToken() });
    server?.disconnectAll();
    publishStatus();
    return getRemoteStatus();
  });
  handle('remote:setPort', async (_e, value: unknown) => {
    const port = parsePort(value as string | number);
    if (port === null) return getRemoteStatus();
    setRemoteAccessConfig({ port });
    if (getRemoteAccessConfig().enabled) {
      await stopRemoteAccess();
      await startServer();
    }
    publishStatus();
    return getRemoteStatus();
  });
  handle('remote:disconnectAll', () => {
    server?.disconnectAll();
    return getRemoteStatus();
  });
  if (getRemoteAccessConfig().enabled) void startServer();
}
