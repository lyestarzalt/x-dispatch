/** Window Controls Overlay height set in main.ts `titleBarOverlay.height`. */
const NATIVE_TITLE_BAR_HEIGHT = 36;
/** Space macOS keeps for the traffic lights with titleBarStyle 'hiddenInset' (Finder, Safari). */
const NATIVE_TRAFFIC_LIGHT_INSET = 78;

/**
 * Title bar sizes in CSS pixels. The window controls are drawn by the OS and
 * ignore Interface Zoom, so the bar divides by the zoom factor to keep the same
 * on-screen size; otherwise zooming out slides the title under the traffic lights.
 */
export function titleBarMetrics(zoomFactor: number) {
  const zoom = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
  return {
    heightPx: NATIVE_TITLE_BAR_HEIGHT / zoom,
    trafficLightInsetPx: NATIVE_TRAFFIC_LIGHT_INSET / zoom,
  };
}
