/**
 * Map controls in the bottom-left group for the loaded plan: one shows or hides the vertical
 * profile, one the strip of the plan's fixes under the toolbar (GitHub #425). Only visible while
 * a plan is on the map; lit while what they control is shown.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useMapStore } from '@/stores/mapStore';
import { MapToggleControl, controlIcon } from './mapToggleControl';
import type { MapRef } from './useMapSetup';

/** lucide `mountain` and `milestone`, the icons the same toggles use in the planner. */
const MOUNTAIN_SVG = controlIcon('<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>');
const MILESTONE_SVG = controlIcon(
  '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z"/>'
);

export function useProfileControl(mapRef: MapRef): void {
  const { t } = useTranslation();
  const profileRef = useRef<MapToggleControl | null>(null);
  const stripRef = useRef<MapToggleControl | null>(null);
  const profileOpen = useMapStore((s) => s.profileStripOpen);
  const stripShown = useFlightPlanStore((s) => s.showFlightPlanBar);
  const hasPlan = useFlightPlanStore((s) => s.fmsData !== null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const profile = new MapToggleControl(MOUNTAIN_SVG, () => {
      const store = useMapStore.getState();
      store.setProfileStripOpen(!store.profileStripOpen);
    });
    const strip = new MapToggleControl(MILESTONE_SVG, () => {
      const store = useFlightPlanStore.getState();
      store.setFlightPlanBarShown(!store.showFlightPlanBar);
    });
    // A bottom corner stacks upwards: the profile button keeps its place, the strip's sits on it.
    map.addControl(profile, 'bottom-left');
    map.addControl(strip, 'bottom-left');
    profileRef.current = profile;
    stripRef.current = strip;
    return () => {
      for (const ctrl of [profile, strip]) {
        if (map.hasControl(ctrl)) map.removeControl(ctrl);
      }
      profileRef.current = null;
      stripRef.current = null;
    };
  }, [mapRef]);

  useEffect(() => {
    profileRef.current?.setState(
      hasPlan,
      profileOpen,
      profileOpen ? t('profile.hide') : t('profile.show')
    );
    stripRef.current?.setState(
      hasPlan,
      stripShown,
      stripShown ? t('flightPlanBar.hide') : t('flightPlanBar.show')
    );
  }, [hasPlan, profileOpen, stripShown, t]);
}
