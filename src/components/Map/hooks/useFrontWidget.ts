import { useCallback } from 'react';
import { type FrontWidget, useMapStore } from '@/stores/mapStore';

/**
 * Stacking for a floating widget that can end up under the planner or the airport card once it
 * is dragged: a press on it brings it above them, and a press on a card (`useSendWidgetsBack`)
 * puts it back underneath. The toolbar always stays on top.
 */
export function useFrontWidget(widget: FrontWidget) {
  const isFront = useMapStore((s) => s.frontWidget === widget);
  const setFrontWidget = useMapStore((s) => s.setFrontWidget);
  const bringToFront = useCallback(() => setFrontWidget(widget), [setFrontWidget, widget]);
  return { isFront, bringToFront };
}

/** Press handler for a side card: it takes the top place back from any raised widget. */
export function useSendWidgetsBack() {
  const setFrontWidget = useMapStore((s) => s.setFrontWidget);
  return useCallback(() => setFrontWidget(null), [setFrontWidget]);
}
