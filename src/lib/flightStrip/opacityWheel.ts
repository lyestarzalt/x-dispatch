/** Capture before map zoom and strip knob handlers. Return false outside the intended panel. */
export function listenOpacityWheel(
  element: Window | HTMLElement,
  adjust: (event: WheelEvent, delta: number) => boolean
) {
  const onWheel = (raw: Event) => {
    const event = raw as WheelEvent;
    if (!event.ctrlKey || !event.deltaY) return;
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    const delta = -Math.sign(pixels) * Math.min(0.1, Math.max(0.01, Math.abs(pixels) / 2000));
    if (!adjust(event, delta)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  element.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return () => element.removeEventListener('wheel', onWheel, true);
}
