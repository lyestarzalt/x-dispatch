/** Soft canvas effects do not need retina pixels; 1x quarters the fill cost on 2x screens. */
const MAX_BACKING_SCALE = 1;

/** Device pixels per CSS pixel to size an effect canvas with. */
export function backingScale(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_BACKING_SCALE);
}
