import {
  useVacOverlaySync,
  useOaciBasemap,
  useOaciVectorSync,
} from '@/components/Map/hooks';
import type { MapRef } from '@/components/Map/hooks/useMapSetup';

/** Map hooks for VAC/OACI — only mount when the sia-france module is enabled. */
export function SiaMapHooks({ mapRef }: { mapRef: MapRef }) {
  useVacOverlaySync(mapRef);
  useOaciBasemap(mapRef);
  useOaciVectorSync(mapRef);
  return null;
}
