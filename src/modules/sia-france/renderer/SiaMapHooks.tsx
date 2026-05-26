import { useVacOverlaySync } from '@/components/Map/hooks';
import type { MapRef } from '@/components/Map/hooks/useMapSetup';

/** Map hooks for VAC overlay — only mount when the sia-france module is enabled. */
export function SiaMapHooks({ mapRef }: { mapRef: MapRef }) {
  useVacOverlaySync(mapRef);
  return null;
}
