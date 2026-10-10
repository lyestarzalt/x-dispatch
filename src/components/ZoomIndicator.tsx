import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

const HOLD_MS = 750;

/**
 * "110%" for a moment after the zoom keys change the Interface Zoom, the way
 * a browser shows its zoom bubble. Reads the setting itself, so the menu and
 * the Settings slider both show it.
 */
export function ZoomIndicator() {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      const level = state.appearance.zoomLevel;
      if (level === previous.appearance.zoomLevel) return;
      setShown(Math.round(level * 100));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShown(null), HOLD_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (shown === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-popover text-foreground border-border pointer-events-none fixed top-14 left-1/2 z-[80] -translate-x-1/2 rounded-lg border px-3 py-1.5 font-mono text-sm select-none"
    >
      {shown}%
    </div>
  );
}
