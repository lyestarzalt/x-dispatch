import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import type { MapRef } from './useMapSetup';

// Locate/crosshair icon matching lucide style
const LOCATE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       style="pointer-events:none;">
    <line x1="2" x2="5" y1="12" y2="12"/>
    <line x1="19" x2="22" y1="12" y2="12"/>
    <line x1="12" x2="12" y1="2" y2="5"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
    <circle cx="12" cy="12" r="7"/>
  </svg>`;

class TrackControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  private btn: HTMLButtonElement | null = null;
  private dot: HTMLSpanElement | null = null;
  private onClick: () => void;

  constructor(onClick: () => void) {
    this.onClick = onClick;
  }

  onAdd(): HTMLDivElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Track aircraft';
    btn.setAttribute('aria-label', 'Track aircraft');
    btn.style.cssText =
      'display: flex; align-items: center; justify-content: center; position: relative;';
    btn.innerHTML = LOCATE_SVG;

    // Pulsing indicator dot
    const dot = document.createElement('span');
    dot.style.cssText = `
      position: absolute; top: 3px; right: 3px;
      width: 6px; height: 6px; border-radius: 50%;
      background: #3b82f6;
      display: none;
    `;
    btn.appendChild(dot);
    this.dot = dot;

    btn.addEventListener('click', this.onClick);

    this.btn = btn;
    this.container.appendChild(btn);
    return this.container;
  }

  /** Update visual state — called reactively from the hook. */
  setState(active: boolean, connected: boolean) {
    if (!this.btn || !this.dot) return;
    const live = active && connected;
    this.btn.style.color = live ? '#3b82f6' : '';
    this.btn.style.backgroundColor = live ? 'rgba(59,130,246,0.12)' : '';
    this.dot.style.display = live ? 'block' : 'none';
    this.dot.style.animation = live ? 'pulse 2s infinite' : '';
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.btn = null;
    this.dot = null;
  }
}

interface UseTrackControlOptions {
  mapRef: MapRef;
  onToggle: () => void;
  isConnected: boolean;
}

export function useTrackControl({ mapRef, onToggle, isConnected }: UseTrackControlOptions) {
  const controlRef = useRef<TrackControl | null>(null);
  const showPlaneTracker = useMapStore((s) => s.showPlaneTracker);

  // Add control
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ctrl = new TrackControl(onToggle);
    controlRef.current = ctrl;
    map.addControl(ctrl, 'bottom-left');

    return () => {
      map.removeControl(ctrl);
      controlRef.current = null;
    };
  }, [mapRef, onToggle]);

  // Sync state
  useEffect(() => {
    controlRef.current?.setState(showPlaneTracker, isConnected);
  }, [showPlaneTracker, isConnected]);
}
