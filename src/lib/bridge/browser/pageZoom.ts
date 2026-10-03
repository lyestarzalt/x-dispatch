/**
 * Browser stand-in for Electron's `webFrame.setZoomFactor`: the Interface Zoom
 * setting scales the whole page through CSS `zoom` on the root element. Like
 * page zoom, it takes part in layout (unlike `transform: scale()`), and
 * MapLibre already divides pointer positions by the resulting scale.
 */
export function setPageZoom(factor: number, root: HTMLElement = document.documentElement): void {
  root.style.zoom = String(factor);
}

export function getPageZoom(root: HTMLElement = document.documentElement): number {
  const parsed = parseFloat(root.style.zoom);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
