import { useEffect, useState } from 'react';

/** Strip functions from a store state object for display */
function stripFunctions(obj: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== 'function') {
      result[key] = value;
    }
  }
  return result;
}

export function StatePanel() {
  const [storeData, setStoreData] = useState<Record<string, unknown> | null>(null);
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const { useAppStore } = await import('@/stores/appStore');
      const { useMapStore } = await import('@/stores/mapStore');
      const { useSettingsStore } = await import('@/stores/settingsStore');
      const { useThemeStore } = await import('@/stores/themeStore');
      const { useLaunchStore } = await import('@/stores/launchStore');
      const { useFlightPlanStore } = await import('@/stores/flightPlanStore');

      setStoreData({
        app: stripFunctions(useAppStore.getState()),
        map: stripFunctions(useMapStore.getState()),
        settings: stripFunctions(useSettingsStore.getState()),
        theme: stripFunctions(useThemeStore.getState()),
        launch: stripFunctions(useLaunchStore.getState()),
        flightPlan: stripFunctions(useFlightPlanStore.getState()),
      });
    };

    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  const toggleStore = (name: string) => {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (!storeData) return <span className="text-muted-foreground/40">Loading...</span>;

  return (
    <div className="space-y-1">
      {Object.entries(storeData).map(([name, state]) => {
        const isExpanded = expandedStores.has(name);
        const keys = Object.keys(state as Record<string, unknown>);
        return (
          <div key={name}>
            <button
              onClick={() => toggleStore(name)}
              className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-sm hover:bg-muted/40"
            >
              <span className="text-xs">{isExpanded ? '▾' : '▸'}</span>
              <span className="font-semibold uppercase tracking-wider text-foreground/70">
                {name}
              </span>
              <span className="ml-auto text-muted-foreground/40">{keys.length} keys</span>
            </button>
            {isExpanded && (
              <pre className="ml-3 overflow-x-auto border-l-2 border-border/30 pl-2 text-sm leading-relaxed text-foreground/60">
                {JSON.stringify(state, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
