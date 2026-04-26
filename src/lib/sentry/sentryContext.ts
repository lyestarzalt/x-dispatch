// src/lib/sentry/sentryContext.ts
import * as Sentry from '@sentry/react';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useMapStore } from '@/stores/mapStore';
import type { LayerVisibility, NavLayerVisibility } from '@/types/layers';

function getActiveLayers(layers: LayerVisibility, nav: NavLayerVisibility): string[] {
  const active: string[] = [];
  for (const [key, value] of Object.entries(layers)) {
    if (value) active.push(key);
  }
  if (nav.navaids) active.push('navaids');
  if (nav.ils) active.push('ils');
  if (nav.airspaces) active.push('airspaces');
  if (nav.airwaysMode !== 'off') active.push(`airways:${nav.airwaysMode}`);
  return active;
}

/**
 * Subscribe to Zustand stores and keep Sentry context in sync.
 * Call once after Sentry.init() in the renderer process.
 * Returns an unsubscribe function.
 */
export function initSentryContext(): () => void {
  const unsubs: (() => void)[] = [];

  // Airport context
  unsubs.push(
    useAppStore.subscribe(
      (s) => ({
        icao: s.selectedICAO,
        name: s.selectedAirportData?.name ?? null,
        startType: s.startPosition?.type ?? null,
        startName: s.startPosition?.name ?? null,
      }),
      (curr, prev) => {
        if (
          curr.icao !== prev.icao ||
          curr.name !== prev.name ||
          curr.startType !== prev.startType ||
          curr.startName !== prev.startName
        ) {
          Sentry.setTag('airport', curr.icao ?? '');
          Sentry.setContext('app_state', {
            airport_name: curr.name,
            start_position:
              curr.startType && curr.startName ? `${curr.startType} / ${curr.startName}` : null,
          });

          if (curr.icao && curr.icao !== prev.icao) {
            Sentry.addBreadcrumb({
              category: 'navigation',
              message: `Airport switched to ${curr.icao}`,
              level: 'info',
            });
          }
        }
      }
    )
  );

  // Aircraft context
  let prevAircraftName = useLaunchStore.getState().selectedAircraft?.name ?? null;
  unsubs.push(
    useLaunchStore.subscribe((s) => {
      const name = s.selectedAircraft?.name ?? null;
      if (name !== prevAircraftName) {
        prevAircraftName = name;
        Sentry.setContext('app_state', {
          ...Sentry.getCurrentScope().getScopeData().contexts?.app_state,
          aircraft: name,
        });
      }
    })
  );

  // Map layers context
  unsubs.push(
    useMapStore.subscribe((s) => {
      Sentry.setContext('map_state', {
        active_layers: getActiveLayers(s.layerVisibility, s.navVisibility),
      });
    })
  );

  // Breadcrumb: flight launched
  let prevLaunching = useLaunchStore.getState().isLaunching;
  unsubs.push(
    useLaunchStore.subscribe((s) => {
      if (s.isLaunching && !prevLaunching) {
        const aircraft = s.selectedAircraft?.name ?? 'unknown';
        Sentry.addBreadcrumb({
          category: 'action',
          message: `Flight launched with ${aircraft}`,
          level: 'info',
        });
      }
      prevLaunching = s.isLaunching;
    })
  );

  // Breadcrumb: dialogs opened
  unsubs.push(
    useAppStore.subscribe(
      (s) => ({ settings: s.showSettings, launch: s.showLaunchDialog }),
      (curr, prev) => {
        if (curr.settings && !prev.settings) {
          Sentry.addBreadcrumb({
            category: 'ui',
            message: 'Settings dialog opened',
            level: 'info',
          });
        }
        if (curr.launch && !prev.launch) {
          Sentry.addBreadcrumb({ category: 'ui', message: 'Launch dialog opened', level: 'info' });
        }
      }
    )
  );

  return () => unsubs.forEach((fn) => fn());
}
