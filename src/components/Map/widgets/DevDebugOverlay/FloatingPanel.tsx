import type { DetachedPanel } from './types';
import { TABS } from './types';
import { useDrag } from './useDrag';

const TAB_WIDTHS: Partial<Record<import('./types').TabId, number>> = {
  db: 720,
};

export function FloatingPanel({
  panel,
  onClose,
  children,
}: {
  panel: DetachedPanel;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { pos, onMouseDown } = useDrag({ x: panel.x, y: panel.y });
  const label = TABS.find((t) => t.id === panel.id)?.label ?? panel.id;
  const width = TAB_WIDTHS[panel.id] ?? 320;

  return (
    <div
      className="fixed z-[60] min-h-[120px] min-w-[280px] select-none resize overflow-auto rounded-lg border border-border/40 bg-background font-mono text-sm text-muted-foreground shadow-2xl"
      style={{ left: pos.x, top: pos.y, width, height: 'auto', maxHeight: '70vh' }}
    >
      <div
        onMouseDown={onMouseDown}
        className="sticky top-0 z-10 flex cursor-grab items-center justify-between border-b border-border/40 bg-background px-3 py-1 active:cursor-grabbing"
      >
        <span className="text-sm font-semibold uppercase tracking-wider text-foreground/60">
          {label}
        </span>
        <button
          onClick={onClose}
          className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-foreground"
        >
          ×
        </button>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}
