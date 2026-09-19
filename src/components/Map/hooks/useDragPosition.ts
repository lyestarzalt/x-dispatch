import { useCallback, useEffect, useRef } from 'react';

const DRAG_THRESHOLD = 5;
const EDGE_PADDING = 16;

export type WidgetPosition = { x: number; y: number } | null;

/**
 * Mouse dragging for a floating map widget. `null` means the widget sits at
 * its default CSS position; a double-click puts it back there.
 */
export function useDragPosition(
  position: WidgetPosition,
  setPosition: (p: WidgetPosition) => void
) {
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
      const maxX = window.innerWidth - rect.width - EDGE_PADDING;
      const maxY = window.innerHeight - rect.height - EDGE_PADDING;

      const newX = Math.max(EDGE_PADDING, Math.min(maxX, startPos.current.x + dx));
      const newY = Math.max(EDGE_PADDING, Math.min(maxY, startPos.current.y + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
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

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setPosition(null);
    },
    [setPosition]
  );

  return { stripRef, position, hasDragged, handleMouseDown, handleDoubleClick };
}
