// @vitest-environment jsdom
/**
 * GitHub #423: a vertical profile left under the toolbar by 2.17 stayed there in 2.18. The
 * strip is not on screen at startup (no plan yet), so the check that pulls a saved position back
 * into reach found nothing to measure, and nothing ran it again once the strip appeared.
 */
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WidgetPosition, useDragPosition } from './useDragPosition';

const TOOLBAR_BOTTOM = 72;
let toolbarBottom = TOOLBAR_BOTTOM;
const resizeCallbacks: Array<() => void> = [];

function Widget({
  show,
  saved,
  onPosition,
}: {
  show: boolean;
  saved: WidgetPosition;
  onPosition: (p: WidgetPosition) => void;
}) {
  const { stripRef } = useDragPosition(saved, onPosition);
  return show ? <div ref={stripRef} data-testid="widget" /> : null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  toolbarBottom = TOOLBAR_BOTTOM;
  resizeCallbacks.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {
        resizeCallbacks.push(this.callback);
      }
      observe() {}
      disconnect() {}
    }
  );
  Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rect = this.hasAttribute('data-map-dock')
      ? { left: 0, top: 0, width: 1600, height: toolbarBottom, bottom: toolbarBottom }
      : { left: 0, top: 0, width: 1200, height: 160, bottom: 160 };
    return { ...rect, right: rect.width, x: 0, y: 0, toJSON: () => rect } as DOMRect;
  });
  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-map-dock', 'top');
  document.body.appendChild(toolbar);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useDragPosition', () => {
  it('pulls a position saved under the toolbar back down when the widget appears later', () => {
    const onPosition = vi.fn();
    const saved = { x: 200, y: 0 };
    act(() => root.render(<Widget show={false} saved={saved} onPosition={onPosition} />));
    expect(onPosition).not.toHaveBeenCalled();

    act(() => root.render(<Widget show saved={saved} onPosition={onPosition} />));
    expect(onPosition).toHaveBeenCalledWith({ x: 200, y: TOOLBAR_BOTTOM + 16 });
  });

  it('moves the widget down when the toolbar grows over it (the flight plan strip appears)', () => {
    const onPosition = vi.fn();
    const saved = { x: 200, y: TOOLBAR_BOTTOM + 16 };
    act(() => root.render(<Widget show saved={saved} onPosition={onPosition} />));
    expect(onPosition).not.toHaveBeenCalled();

    toolbarBottom = 120;
    act(() => resizeCallbacks.forEach((run) => run()));
    expect(onPosition).toHaveBeenCalledWith({ x: 200, y: 136 });
  });
});
