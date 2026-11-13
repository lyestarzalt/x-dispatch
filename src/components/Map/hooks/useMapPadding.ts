import { type RefObject, useEffect, useRef } from 'react';
import type { PaddingOptions } from 'maplibre-gl';
import type { MapRef } from './useMapSetup';

/**
 * Keep the map's camera padding equal to the screen taken by docked panels.
 *
 * Panels that sit over the map (planner, airport panel, top bar, profile
 * strip) mark themselves with `data-map-dock="left|right|top|bottom"`. Their
 * rectangles are measured against the map's own box and handed to
 * MapLibre's `setPadding`, so every `fitBounds` and `flyTo` frames its target
 * inside the part of the map the pilot can see. Nothing is hard-coded: a
 * panel that opens, closes, collapses or resizes is picked up by observing
 * the DOM, after its CSS transition has finished.
 */

export type DockSide = 'left' | 'right' | 'top' | 'bottom';
const SIDES: readonly DockSide[] = ['left', 'right', 'top', 'bottom'];

/** Breathing room between a panel's edge and whatever the camera frames. */
export const DOCK_GAP_PX = 12;

export interface DockRect {
  side: DockSide;
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>;
  boundsProfile?: boolean;
}

/** MapLibre's padding with every side present. */
export type Padding = Required<PaddingOptions>;
export const NO_PADDING: Padding = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Padding that keeps the camera clear of the docked panels: for each side,
 * how far the furthest panel on that side reaches into the map, plus a gap.
 * A panel that is not drawn (zero size) counts for nothing. Padding is
 * capped so the two sides of an axis can never swallow the whole map.
 */
export function dockPadding(
  container: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>,
  docks: readonly DockRect[],
  gap = DOCK_GAP_PX
): Padding {
  const padding: Padding = { ...NO_PADDING };
  for (const { side, rect } of docks) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const reach =
      side === 'left'
        ? rect.right - container.left
        : side === 'right'
          ? container.right - rect.left
          : side === 'top'
            ? rect.bottom - container.top
            : container.bottom - rect.top;
    if (reach <= 0) continue;
    padding[side] = Math.max(padding[side], reach + gap);
  }
  // A single expanded panel can use more than one third of a narrow window.
  // Share the horizontal budget so the camera frames what is still visible.
  const maxHorizontal = container.width * 0.75;
  const horizontal = padding.left + padding.right;
  if (horizontal > maxHorizontal) {
    padding.left *= maxHorizontal / horizontal;
    padding.right *= maxHorizontal / horizontal;
  }
  const maxY = container.height / 3;
  padding.top = Math.min(padding.top, maxY);
  padding.bottom = Math.min(padding.bottom, maxY);
  return padding;
}

export function samePadding(a: Padding, b: Padding): boolean {
  return SIDES.every((side) => Math.round(a[side]) === Math.round(b[side]));
}

function isDockSide(value: string | null): value is DockSide {
  return value !== null && (SIDES as readonly string[]).includes(value);
}

/** Every docked panel inside the map's root, measured now. */
export function measureDocks(root: HTMLElement): DockRect[] {
  const docks: DockRect[] = [];
  root.querySelectorAll<HTMLElement>('[data-map-dock]').forEach((el) => {
    const side = el.getAttribute('data-map-dock');
    if (isDockSide(side)) {
      docks.push({
        side,
        rect: el.getBoundingClientRect(),
        boundsProfile: el.hasAttribute('data-map-profile-inset'),
      });
    }
  });
  return docks;
}

/** How long the view takes to glide into a changed padding. */
export const PADDING_EASE_MS = 300;

interface UseMapPaddingOptions {
  mapRef: MapRef;
  /** The element the map and its docked panels live in. */
  rootRef: RefObject<HTMLElement | null>;
  /**
   * Called once the new padding is on the map. Return true after moving the
   * camera yourself (a refit animates from here); otherwise the hook glides
   * the view into the new padding, since a bare padding change shifts it.
   */
  onChange?: (padding: Padding) => boolean | void;
}

export function useMapPadding({ mapRef, rootRef, onChange }: UseMapPaddingOptions): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;
    let current: Padding = NO_PADDING;
    let applied = false;
    let waitingForMoveEnd = false;

    let observedProfile: HTMLElement | null = null;
    const resize = new ResizeObserver(apply);

    // Runs straight from the DOM observers, before React's effects: a panel that opens and
    // flies the map somewhere in the same tick then flies with the padding already in place.
    // MapLibre's setPadding is a jumpTo, which stops a running camera animation, so a change
    // that lands mid-flight waits for the flight to end.
    function apply() {
      const map = mapRef.current;
      if (!map || !root.isConnected) return;
      const bounds = root.getBoundingClientRect();
      const profile = root.querySelector<HTMLElement>('[data-map-dock="bottom"][data-map-profile]');
      if (profile !== observedProfile) {
        if (observedProfile) resize.unobserve(observedProfile);
        if (profile) resize.observe(profile);
        observedProfile = profile;
      }
      const docks = measureDocks(root);
      let profileLeft = 0;
      let profileRight = 0;
      for (const { side, rect, boundsProfile } of docks) {
        if (!boundsProfile || rect.width === 0 || rect.height === 0) continue;
        if (side === 'left') profileLeft = Math.max(profileLeft, rect.right - bounds.left);
        if (side === 'right') profileRight = Math.max(profileRight, bounds.right - rect.left);
      }
      for (const [side, inset] of [
        ['left', profileLeft],
        ['right', profileRight],
      ] as const) {
        const property = `--map-profile-${side}`;
        const value = inset ? `${inset + DOCK_GAP_PX}px` : '';
        if (root.style.getPropertyValue(property) !== value)
          root.style.setProperty(property, value);
      }
      const profileHeight = profile?.getBoundingClientRect().height ?? 0;
      const replayBottom = profileHeight ? `calc(${profileHeight}px + 1.75rem)` : '';
      if (root.style.getPropertyValue('--map-replay-bottom') !== replayBottom) {
        root.style.setProperty('--map-replay-bottom', replayBottom);
      }
      if (map.isMoving()) {
        if (!waitingForMoveEnd) {
          waitingForMoveEnd = true;
          // A beat later: `moveend` is dispatched from inside the frame that ends an ease, and
          // starting the padding ease there trips MapLibre (Sentry X-DISPATCH-6T).
          map.once('moveend', () => {
            waitingForMoveEnd = false;
            setTimeout(apply, 0);
          });
        }
        return;
      }
      const next = dockPadding(bounds, docks);
      if (samePadding(next, current)) return;
      const previous = current;
      const first = !applied;
      current = next;
      applied = true;
      map.setPadding(next);
      const moved = onChangeRef.current?.(next) === true;
      if (moved || first) return;
      // Nobody moved the camera: take the padding back and glide into it instead of jumping.
      map.setPadding(previous);
      map.easeTo({ padding: next, duration: PADDING_EASE_MS });
    }

    // Panels mount, unmount, collapse or move: watch the tree, then settle after their transition.
    const mutations = new MutationObserver(apply);
    mutations.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'data-map-dock',
        'data-map-profile-inset',
        'data-map-profile',
      ],
    });
    resize.observe(root);
    const toolbar = root.querySelector('[data-map-dock="top"]');
    if (toolbar) resize.observe(toolbar);
    root.addEventListener('transitionend', apply);
    apply();

    return () => {
      mutations.disconnect();
      resize.disconnect();
      root.removeEventListener('transitionend', apply);
    };
  }, [mapRef, rootRef]);
}
