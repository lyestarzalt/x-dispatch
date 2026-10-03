/**
 * Installs window.*API in a browser on another device (tablet access).
 * Runs before any app module loads; see src/renderer.tsx.
 */
import { WS_PATH } from '@/lib/remote/protocol';
import { type BridgeTransport, buildBridgeApis } from '../apiSurface';
import { getPageZoom, setPageZoom } from './pageZoom';
import { type RemoteConnectionState, WsTransport } from './wsTransport';

export type RemoteStateListener = (state: RemoteConnectionState) => void;
const stateListeners = new Set<RemoteStateListener>();
let currentState: RemoteConnectionState = 'connecting';

export function onRemoteConnectionState(listener: RemoteStateListener): () => void {
  stateListeners.add(listener);
  listener(currentState);
  return () => {
    stateListeners.delete(listener);
  };
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Not a secure context on plain HTTP: fall through.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

async function copyImage(dataUrl: string): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Channels the tablet answers itself; the rest go to the desktop. */
function withLocalChannels(remote: BridgeTransport): BridgeTransport {
  return {
    ...remote,
    invoke: (channel, ...args) => {
      switch (channel) {
        case 'app:openExternal':
          window.open(String(args[0]), '_blank', 'noopener');
          return Promise.resolve({ success: true });
        case 'app:clipboardWrite':
          return copyText(String(args[0]));
        case 'app:clipboardWriteImage':
          return copyImage(String(args[0]));
        default:
          return remote.invoke(channel, ...args);
      }
    },
  };
}

export function installRemoteBridge(): void {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  const transport = new WsTransport({
    url: `${scheme}://${location.host}${WS_PATH}`,
    onStateChange: (state) => {
      currentState = state;
      stateListeners.forEach((l) => l(state));
    },
  });
  transport.connect();
  // The token travelled in the URL once; the cookie carries it from here on.
  if (new URL(location.href).searchParams.has('token')) {
    history.replaceState(null, '', location.pathname);
  }
  const apis = buildBridgeApis(withLocalChannels(transport), {
    platform: 'linux',
    isRemoteClient: true,
    setZoomFactor: (factor) => setPageZoom(factor),
    getZoomFactor: () => getPageZoom(),
    getFilePathForDrop: () => {
      throw new Error('desktop-only');
    },
    versions: { node: () => '', chrome: () => navigator.userAgent, electron: () => '' },
  });
  Object.assign(window, apis);
}
