import type * as maplibregl from 'maplibre-gl';

/**
 * One on/off button in the map's own column of controls (bottom-left). Shared by the buttons
 * that show or hide something of the loaded plan; lit in the accent colour while on.
 */
export class MapToggleControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  private btn: HTMLButtonElement | null = null;

  constructor(
    private readonly iconSvg: string,
    private readonly onClick: () => void
  ) {}

  onAdd(): HTMLDivElement {
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display: flex; align-items: center; justify-content: center;';
    btn.innerHTML = this.iconSvg;
    btn.addEventListener('click', this.onClick);
    this.btn = btn;
    this.container.appendChild(btn);
    return this.container;
  }

  /** `label` is the tooltip and the accessible name: what a click will do. */
  setState(visible: boolean, active: boolean, label: string): void {
    if (!this.container || !this.btn) return;
    this.container.style.display = visible ? '' : 'none';
    this.btn.title = label;
    this.btn.setAttribute('aria-label', label);
    this.btn.setAttribute('aria-pressed', String(active));
    this.btn.style.color = active ? '#3b82f6' : '';
    this.btn.style.backgroundColor = active ? 'rgba(59,130,246,0.12)' : '';
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.btn = null;
  }
}

/** A lucide icon's paths as the 18px inline SVG the map controls use. */
export function controlIcon(paths: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">${paths}</svg>`;
}
