/**
 * A map control in the bottom-left group that shows or hides the vertical profile strip. Only
 * visible while a plan is loaded; lit while the strip is open.
 */
import { useEffect, useRef } from 'react';
import i18n from 'i18next';
import * as maplibregl from 'maplibre-gl';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useMapStore } from '@/stores/mapStore';
import type { MapRef } from './useMapSetup';

const MOUNTAIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>';

class ProfileControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  private btn: HTMLButtonElement | null = null;
  private onClick: () => void;

  constructor(onClick: () => void) {
    this.onClick = onClick;
  }

  onAdd(): HTMLDivElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display: flex; align-items: center; justify-content: center;';
    btn.innerHTML = MOUNTAIN_SVG;
    btn.addEventListener('click', this.onClick);
    this.btn = btn;
    this.container.appendChild(btn);
    return this.container;
  }

  setState(visible: boolean, active: boolean): void {
    if (!this.container || !this.btn) return;
    this.container.style.display = visible ? '' : 'none';
    const label = active ? i18n.t('profile.hide') : i18n.t('profile.show');
    this.btn.title = label;
    this.btn.setAttribute('aria-label', label);
    this.btn.style.color = active ? '#3b82f6' : '';
    this.btn.style.backgroundColor = active ? 'rgba(59,130,246,0.12)' : '';
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.btn = null;
  }
}

export function useProfileControl(mapRef: MapRef): void {
  const controlRef = useRef<ProfileControl | null>(null);
  const open = useMapStore((s) => s.profileStripOpen);
  const hasPlan = useFlightPlanStore((s) => s.fmsData !== null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ctrl = new ProfileControl(() => {
      const store = useMapStore.getState();
      store.setProfileStripOpen(!store.profileStripOpen);
    });
    map.addControl(ctrl, 'bottom-left');
    controlRef.current = ctrl;
    return () => {
      if (map.hasControl(ctrl)) map.removeControl(ctrl);
      controlRef.current = null;
    };
  }, [mapRef]);

  useEffect(() => {
    controlRef.current?.setState(hasPlan, open);
  }, [hasPlan, open]);
}
