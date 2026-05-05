import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { collectLayerInspectorData } from '../layerInspector';
import { FloatingPanel } from './FloatingPanel';
import { DatabasePanel } from './panels/DatabasePanel';
import { LayersPanel } from './panels/LayersPanel';
import { MapPanel } from './panels/MapPanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { PerfPanel } from './panels/PerfPanel';
import { StatePanel } from './panels/StatePanel';
import type { DebugStats, DetachedPanel, MapRef, TabId } from './types';
import { TABS } from './types';

export default function DevDebugOverlay({ mapRef }: { mapRef: MapRef }) {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const visible = useSettingsStore((s) => s.appearance.debugOverlay);
  const setDebugOverlay = useSettingsStore((s) => s.setDebugOverlay);
  const [detached, setDetached] = useState<DetachedPanel[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });

  const hasLayersOpen = detached.some((d) => d.id === 'layers');

  // FPS counter
  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !map) return;
    const onRender = () => {
      const now = performance.now();
      fpsRef.current.frames++;
      const elapsed = now - fpsRef.current.lastTime;
      if (elapsed >= 1000) {
        fpsRef.current.fps = Math.round((fpsRef.current.frames * 1000) / elapsed);
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }
    };
    map.on('render', onRender);
    return () => {
      map.off('render', onRender);
    };
  }, [mapRef, visible]);

  // Data collection
  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const update = async () => {
      const map = mapRef.current;
      if (!map) return;

      const style = map.getStyle();
      const proj = map.getProjection?.();

      let appVersion = '—';
      try {
        appVersion = await window.appAPI.getVersion();
      } catch {
        /* ignore */
      }

      let xplanePath = '—';
      try {
        xplanePath = (await window.xplaneAPI.getPath()) ?? '—';
      } catch {
        /* ignore */
      }

      let configPath = '—';
      try {
        configPath = await window.appAPI.getConfigPath();
      } catch {
        /* ignore */
      }

      let logPath = '—';
      try {
        logPath = await window.appAPI.getLogPath();
      } catch {
        /* ignore */
      }

      let ipcLatencyMs = 0;
      try {
        const start = performance.now();
        await window.appAPI.getVersion();
        ipcLatencyMs = Math.round(performance.now() - start);
      } catch {
        /* ignore */
      }

      let mainRssMB = '—';
      let mainHeapMB = '—';
      try {
        const mainMem = await window.appAPI.getProcessMemory();
        mainRssMB = `${(mainMem.rss / 1024 / 1024).toFixed(0)}MB`;
        mainHeapMB = `${(mainMem.heapUsed / 1024 / 1024).toFixed(0)}MB`;
      } catch {
        /* ignore */
      }

      let tileCacheEntries = 0;
      let tileCacheSize = '—';
      let tileCacheHitRate = '—';
      try {
        const cacheStats = await window.appAPI.getTileCacheStats();
        tileCacheEntries = cacheStats.entryCount;
        tileCacheSize = `${(cacheStats.totalSize / 1024 / 1024).toFixed(0)}MB`;
        tileCacheHitRate =
          cacheStats.hitRate > 0 ? `${(cacheStats.hitRate * 100).toFixed(0)}%` : '—';
      } catch {
        /* ignore */
      }

      let xplaneWs = 'off';
      try {
        const connected = await window.xplaneServiceAPI.isStreamConnected();
        xplaneWs = connected ? 'connected' : 'disconnected';
      } catch {
        /* ignore */
      }

      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const rendererHeapMB = mem ? `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(0)}MB` : '—';

      const { useMapStore } = await import('@/stores/mapStore');
      const { vatsimEnabled, ivaoEnabled } = useMapStore.getState();

      const { useAppStore } = await import('@/stores/appStore');
      const { selectedICAO, selectedAirportIsCustom } = useAppStore.getState();

      const inspectorData = hasLayersOpen ? collectLayerInspectorData(map) : [];

      setStats({
        appVersion,
        env: process.env.NODE_ENV ?? 'unknown',
        electronVersion: window.versions.electron(),
        chromeVersion: window.versions.chrome(),
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        projection: (proj as { type?: string })?.type ?? 'unknown',
        center: [map.getCenter().lng, map.getCenter().lat],
        fps: fpsRef.current.fps,
        layerCount: style?.layers?.length ?? 0,
        sourceCount: style?.sources ? Object.keys(style.sources).length : 0,
        airportICAO: selectedICAO,
        airportSource: selectedICAO ? (selectedAirportIsCustom ? 'custom' : 'default') : '—',
        inspectorData,
        terrainActive: map.getTerrain() != null,
        terrainSourceLoaded: !!map.getSource('terrain-dem'),
        hillshadeSourceLoaded: !!map.getSource('terrain-hillshade-dem'),
        tileCacheEntries,
        tileCacheSize,
        tileCacheHitRate,
        xplaneWs,
        vatsimEnabled,
        ivaoEnabled,
        rendererHeapMB,
        mainRssMB,
        mainHeapMB,
        ipcLatencyMs,
        xplanePath,
        configPath,
        logPath,
      });
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mapRef, visible, hasLayersOpen]);

  // Keyboard toggle
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        setDebugOverlay(!visible);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [visible, setDebugOverlay]);

  if (!visible) return null;

  const handleTabClick = (id: TabId) => {
    // Already open — close it
    if (detached.some((d) => d.id === id)) {
      setDetached((prev) => prev.filter((d) => d.id !== id));
      return;
    }
    // Open as floating window, center on screen
    const x = Math.round(window.innerWidth / 2 - 160);
    const y = Math.round(window.innerHeight / 3 + detached.length * 30);
    setDetached((prev) => [...prev, { id, x, y }]);
  };

  const closeDetached = (id: TabId) => {
    setDetached((prev) => prev.filter((d) => d.id !== id));
  };

  const renderPanel = (tabId: TabId) => {
    if (!stats) return null;
    switch (tabId) {
      case 'map':
        return <MapPanel stats={stats} />;
      case 'layers':
        return <LayersPanel stats={stats} mapRef={mapRef} />;
      case 'network':
        return <NetworkPanel stats={stats} />;
      case 'perf':
        return <PerfPanel stats={stats} />;
      case 'state':
        return <StatePanel />;
      case 'db':
        return <DatabasePanel />;
    }
  };

  return (
    <>
      {/* Toolbar — `top-9` keeps it below the custom title bar (h-9). The
          title bar's `WebkitAppRegion: 'drag'` is an OS-level window-drag
          region that intercepts pointer events even through higher
          z-indexes; overlapping it makes the tabs unclickable. */}
      <div className="fixed inset-x-0 top-9 z-50 flex select-none flex-col font-mono text-sm text-muted-foreground">
        <div className="flex items-center gap-px border-b border-border/40 bg-background px-2 py-0.5">
          <span className="mr-2 text-sm font-semibold tracking-wider text-foreground/60">
            DEBUG
          </span>

          {TABS.map((tab) => {
            const isOpen = detached.some((d) => d.id === tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                title={tab.tip}
                className={`rounded px-2 py-0.5 text-sm transition-colors ${
                  isOpen
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Quick stats */}
          {stats && (
            <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground/50">
              <span title="Current zoom level">z{stats.zoom.toFixed(1)}</span>
              {stats.airportICAO && <span title="Selected airport">{stats.airportICAO}</span>}
            </div>
          )}

          <button
            onClick={() => setDebugOverlay(false)}
            title="Close debug toolbar (Ctrl+Shift+D)"
            className="ml-2 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/40 hover:bg-muted hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>

      {/* Detached floating panels */}
      {detached.map((panel) => (
        <FloatingPanel key={panel.id} panel={panel} onClose={() => closeDetached(panel.id)}>
          {renderPanel(panel.id)}
        </FloatingPanel>
      ))}
    </>
  );
}
