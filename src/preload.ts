import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron';
import { type BridgeTransport, buildBridgeApis } from './lib/bridge/apiSurface';

const ipcTransport: BridgeTransport = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      listener(payload as never);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

const apis = buildBridgeApis(ipcTransport, {
  platform: process.platform,
  isRemoteClient: false,
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),
  getFilePathForDrop: (file) => webUtils.getPathForFile(file),
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
  },
});

for (const [name, api] of Object.entries(apis)) {
  contextBridge.exposeInMainWorld(name, api);
}
