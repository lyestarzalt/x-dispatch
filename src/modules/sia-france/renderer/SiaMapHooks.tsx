import type { MapRef } from '@/components/Map/hooks/useMapSetup';
import { useVacOverlaySync } from './hooks/useVacOverlaySync';

/** Map hooks for VAC overlay — only mount when the sia-france module is enabled. */
export function SiaMapHooks({ mapRef }: { mapRef: MapRef }) {
  useVacOverlaySync(mapRef);
  return null;
}
