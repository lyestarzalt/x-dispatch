/** True when the UI runs in a browser on another device (tablet access). */
export function useIsRemoteClient(): boolean {
  return window.appAPI?.isRemoteClient === true;
}
