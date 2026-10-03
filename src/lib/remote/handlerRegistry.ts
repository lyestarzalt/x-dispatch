/**
 * One registry for every main-process handler.
 *
 * `handle` / `on` register with ipcMain exactly as before and also keep the
 * function, so the remote (tablet) dispatcher can call the same handlers.
 * `broadcast` replaces the scattered `webContents.send` calls and reaches
 * the desktop window(s) and every connected tablet.
 */
import { BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron';
import { isRemoteAllowed } from '@/lib/bridge/channelPolicy';

/** What a handler sees as `event.sender` when the call came from a tablet. */
export interface RemoteSender {
  id: string;
  send: (channel: string, ...args: unknown[]) => void;
  isDestroyed: () => boolean;
}

export interface RemoteEvent {
  sender: RemoteSender;
  remote: true;
}

export type InvokeHandler = (event: IpcMainInvokeEvent, ...args: never[]) => unknown;
export type SendHandler = (event: Electron.IpcMainEvent, ...args: never[]) => void;

export type RemoteResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      error: { code: 'desktop-only' | 'unknown-channel' | 'handler-error'; message: string };
    };

const invokeHandlers = new Map<string, InvokeHandler>();
const sendHandlers = new Map<string, SendHandler>();
let remoteBroadcaster: ((channel: string, ...args: unknown[]) => void) | null = null;

export function handle(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: any[]) => unknown
): void {
  invokeHandlers.set(channel, fn as InvokeHandler);
  ipcMain.handle(channel, fn);
}

export function on(
  channel: string,
  fn: (event: Electron.IpcMainEvent, ...args: any[]) => void
): void {
  sendHandlers.set(channel, fn as SendHandler);
  ipcMain.on(channel, fn);
}

export async function invokeRemote(
  sender: RemoteSender,
  channel: string,
  args: unknown[]
): Promise<RemoteResult> {
  if (!isRemoteAllowed(channel)) {
    return {
      ok: false,
      error: { code: 'desktop-only', message: `${channel} is only available on the desktop` },
    };
  }
  const fn = invokeHandlers.get(channel);
  if (!fn) {
    return { ok: false, error: { code: 'unknown-channel', message: `No handler for ${channel}` } };
  }
  const event: RemoteEvent = { sender, remote: true };
  try {
    const value = await fn(event as unknown as IpcMainInvokeEvent, ...(args as never[]));
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: { code: 'handler-error', message: (err as Error).message } };
  }
}

export function sendRemote(sender: RemoteSender, channel: string, args: unknown[]): void {
  if (!isRemoteAllowed(channel)) return;
  const fn = sendHandlers.get(channel);
  if (!fn) return;
  const event: RemoteEvent = { sender, remote: true };
  fn(event as unknown as Electron.IpcMainEvent, ...(args as never[]));
}

export function setRemoteBroadcaster(
  fn: ((channel: string, ...args: unknown[]) => void) | null
): void {
  remoteBroadcaster = fn;
}

/** Push to every desktop window and every connected tablet. */
export function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  }
  remoteBroadcaster?.(channel, ...args);
}

export function resetRegistryForTests(): void {
  invokeHandlers.clear();
  sendHandlers.clear();
  remoteBroadcaster = null;
}
