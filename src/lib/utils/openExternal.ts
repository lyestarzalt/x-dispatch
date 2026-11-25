/**
 * Opens a web address outside the app. On the PC the main process hands it to the system
 * browser; on a tablet that request is refused (it would open on the PC), so the tablet's own
 * browser opens it in a new tab.
 */
export function openExternalLink(url: string): void {
  if (window.appAPI.isRemoteClient) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void window.appAPI.openExternal(url);
}
