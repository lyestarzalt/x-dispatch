import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 5;
const EDGE_PADDING = 16;

export type WidgetPosition = { x: number; y: number } | null;

/**
 * A widget's position kept inside the window and below the toolbar, so its drag bar is
 * always within reach (GitHub #419). `topInset` is the toolbar's bottom edge, 0 without one.
 * When the window is too short the top limit wins.
 */
export function clampWidgetPosition(
  p: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  topInset: number
): { x: number; y: number } {
  const minY = topInset + EDGE_PADDING;
  const maxX = Math.max(EDGE_PADDING, viewport.width - size.width - EDGE_PADDING);
  const maxY = Math.max(minY, viewport.height - size.height - EDGE_PADDING);
  return {
    x: Math.max(EDGE_PADDING, Math.min(maxX, p.x)),
    y: Math.max(minY, Math.min(maxY, p.y)),
  };
}

/** Bottom of the map toolbar, 0 in a window without one. */
function toolbarBottom(): number {
  return document.querySelector('[data-map-dock="top"]')?.getBoundingClientRect().bottom ?? 0;
}

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * Mouse dragging for a floating map widget. `null` means the widget sits at
 * its default CSS position; a double-click puts it back there.
 */
export function useDragPosition(
  savedPosition: WidgetPosition,
  setPosition: (p: WidgetPosition) => void
) {
  // While dragging the widget follows a local position and the store is written once, on
  // release: a persisted store re-serialised on every mouse move made the drag stutter.
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const position = dragPosition ?? savedPosition;
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const stripRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;

      const el = stripRef.current;
      if (!el) return;

      isDragging.current = true;
      hasDragged.current = false;
      startMouse.current = { x: e.clientX, y: e.clientY };

      const rect = el.getBoundingClientRect();
      startPos.current = position ?? { x: rect.left, y: rect.top };
    },
    [position]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !stripRef.current) return;

      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;

      if (!hasDragged.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      hasDragged.current = true;

      const rect = stripRef.current.getBoundingClientRect();
      const next = clampWidgetPosition(
        { x: startPos.current.x + dx, y: startPos.current.y + dy },
        rect,
        viewport(),
        toolbarBottom()
      );
      dragPositionRef.current = next;
      setDragPosition(next);
    };

    const handleMouseUp = () => {
      if (isDragging.current && dragPositionRef.current) {
        setPosition(dragPositionRef.current);
        dragPositionRef.current = null;
        setDragPosition(null);
      }
      isDragging.current = false;
      setTimeout(() => {
        hasDragged.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setPosition]);

  // A position saved under another window size or interface zoom, or under the toolbar by an
  // older version, can land out of reach; pull it back in so the widget is never lost.
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el || !savedPosition) return;
    const clamp = () => {
      const { x, y } = clampWidgetPosition(
        savedPosition,
        el.getBoundingClientRect(),
        viewport(),
        toolbarBottom()
      );
      if (x !== savedPosition.x || y !== savedPosition.y) setPosition({ x, y });
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [savedPosition, setPosition]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setPosition(null);
    },
    [setPosition]
  );

  return { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick };
}
