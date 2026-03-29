import { useCallback, useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { collectLayerInspectorData } from './layerInspector';
import type {
  LayerInspectorGroup,
  LayerStatus,
  RendererInfo,
  SublayerInfo,
} from './layerInspector';

// --- Types ---

interface DebugStats {
  appVersion: string;
  env: string;
  electronVersion: string;
  chromeVersion: string;
  zoom: number;
  pitch: number;
  projection: string;
  center: [number, number];
  fps: number;
  layerCount: number;
  sourceCount: number;
  airportICAO: string | null;
  airportSource: string;
  inspectorData: LayerInspectorGroup[];
  terrainActive: boolean;
  terrainSourceLoaded: boolean;
  hillshadeSourceLoaded: boolean;
  tileCacheEntries: number;
  tileCacheSize: string;
  tileCacheHitRate: string;
  xplaneWs: string;
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;
  rendererHeapMB: string;
  mainRssMB: string;
  mainHeapMB: string;
  ipcLatencyMs: number;
  xplanePath: string;
  configPath: string;
  logPath: string;
}

type MapRef = React.RefObject<maplibregl.Map | null>;
type TabId = 'map' | 'layers' | 'network' | 'perf' | 'state';

interface DetachedPanel {
  id: TabId;
  x: number;
  y: number;
}

const TABS: { id: TabId; label: string; tip: string }[] = [
  { id: 'map', label: 'Map', tip: 'Map state, airport, terrain' },
  { id: 'layers', label: 'Layers', tip: 'Layer inspector — click layers to toggle visibility' },
  { id: 'network', label: 'Net', tip: 'X-Plane WebSocket, VATSIM, IVAO' },
  { id: 'perf', label: 'Perf', tip: 'Memory, IPC latency, FPS, cache' },
  { id: 'state', label: 'State', tip: 'App state — stores, settings, selections' },
];

// --- Drag hook ---

function useDrag(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragging.current = true;
      offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      e.preventDefault();
    },
    [pos]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return { pos, setPos, onMouseDown };
}

// --- Toggle layer visibility on map ---

function toggleLayerVisibility(map: maplibregl.Map, layerId: string) {
  const current = map.getLayoutProperty(layerId, 'visibility');
  map.setLayoutProperty(layerId, 'visibility', current === 'none' ? 'visible' : 'none');
}

function toggleRendererVisibility(map: maplibregl.Map, renderer: RendererInfo) {
  // Toggle all layers in this renderer group (primary + sublayers)
  const allIds = [renderer.primaryLayerId, ...renderer.sublayers.map((s) => s.layerId)];
  // If any are visible, hide all. If all hidden, show all.
  const anyVisible = allIds.some(
    (id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none'
  );
  for (const id of allIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', anyVisible ? 'none' : 'visible');
    }
  }
}

// --- Main component ---

export default function DevDebugOverlay({ mapRef }: { mapRef: MapRef }) {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [visible, setVisible] = useState(false);
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
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div className="fixed inset-x-0 top-0 z-50 flex select-none flex-col font-mono text-[11px] text-muted-foreground">
        <div className="flex items-center gap-px border-b border-border/40 bg-background px-2 py-0.5">
          <span className="mr-2 text-[10px] font-semibold tracking-wider text-foreground/60">
            DEBUG
          </span>

          {TABS.map((tab) => {
            const isOpen = detached.some((d) => d.id === tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                title={tab.tip}
                className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
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
            <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground/50">
              <span title="Frames per second">
                <span
                  className={
                    stats.fps >= 30
                      ? 'text-success'
                      : stats.fps >= 15
                        ? 'text-warning'
                        : 'text-destructive'
                  }
                >
                  {stats.fps}
                </span>{' '}
                fps
              </span>
              <span title="Current zoom level">z{stats.zoom.toFixed(1)}</span>
              {stats.airportICAO && <span title="Selected airport">{stats.airportICAO}</span>}
            </div>
          )}

          <button
            onClick={() => setVisible(false)}
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

// --- Floating detached panel ---

function FloatingPanel({
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

  return (
    <div
      className="fixed z-[60] min-h-[120px] min-w-[280px] select-none resize overflow-auto rounded-lg border border-border/40 bg-background font-mono text-[11px] text-muted-foreground shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: 320, height: 'auto', maxHeight: '70vh' }}
    >
      <div
        onMouseDown={onMouseDown}
        className="sticky top-0 z-10 flex cursor-grab items-center justify-between border-b border-border/40 bg-background px-3 py-1 active:cursor-grabbing"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
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

// --- Tab panels ---

function MapPanel({ stats }: { stats: DebugStats }) {
  return (
    <div className="grid grid-cols-2 gap-x-6">
      <div>
        <SectionLabel>App</SectionLabel>
        <Row
          label="Version"
          value={`v${stats.appVersion} ${stats.env === 'production' ? '' : '(dev)'}`}
          tip="App version and environment"
        />
        <Row
          label="Electron"
          value={`${stats.electronVersion} / Cr ${stats.chromeVersion}`}
          tip="Electron / Chromium version"
        />
      </div>
      <div>
        <SectionLabel>Map</SectionLabel>
        <Row label="Zoom" value={stats.zoom.toFixed(2)} tip="Current map zoom level" />
        <Row
          label="Center"
          value={`${stats.center[1].toFixed(3)}, ${stats.center[0].toFixed(3)}`}
          tip="Map center (lat, lng)"
        />
        <Row
          label="Layers / Src"
          value={`${stats.layerCount} / ${stats.sourceCount}`}
          tip="Total MapLibre layers / sources"
        />
      </div>
      <div>
        <SectionLabel>Airport</SectionLabel>
        <Row
          label="ICAO"
          value={stats.airportICAO ? `${stats.airportICAO} (${stats.airportSource})` : 'none'}
          status={stats.airportSource === 'custom' ? 'ok' : undefined}
          tip="Selected airport and scenery source"
        />
      </div>
      <div>
        <SectionLabel>Terrain</SectionLabel>
        <Row
          label="3D / DEM / Hill"
          value={`${stats.terrainActive ? 'ON' : 'OFF'} / ${stats.terrainSourceLoaded ? 'ok' : '!'} / ${stats.hillshadeSourceLoaded ? 'ok' : '!'}`}
          status={stats.terrainActive && stats.terrainSourceLoaded ? 'ok' : 'error'}
          tip="3D terrain / DEM source / Hillshade source"
        />
      </div>
      <div className="col-span-2">
        <SectionLabel>Paths</SectionLabel>
        <PathRow label="X-Plane" value={stats.xplanePath} />
        <PathRow
          label="Custom Scenery"
          value={stats.xplanePath !== '—' ? `${stats.xplanePath}/Custom Scenery` : '—'}
        />
        <PathRow
          label="scenery_packs.ini"
          value={
            stats.xplanePath !== '—' ? `${stats.xplanePath}/Custom Scenery/scenery_packs.ini` : '—'
          }
        />
        <PathRow label="Config" value={stats.configPath} />
        <PathRow label="Log" value={stats.logPath} />
      </div>
    </div>
  );
}

function LayersPanel({ stats, mapRef }: { stats: DebugStats; mapRef: MapRef }) {
  if (stats.inspectorData.length === 0) {
    return <span className="text-muted-foreground/40">No app layers on map</span>;
  }
  return (
    <div className="space-y-1">
      {stats.inspectorData.map((group) => (
        <InspectorGroup key={group.category} group={group} mapRef={mapRef} />
      ))}
      <Legend />
    </div>
  );
}

function NetworkPanel({ stats }: { stats: DebugStats }) {
  return (
    <div className="max-w-xs">
      <Row
        label="X-Plane WS"
        value={stats.xplaneWs}
        status={stats.xplaneWs === 'connected' ? 'ok' : stats.xplaneWs === 'off' ? 'off' : 'error'}
        tip="WebSocket connection to X-Plane"
      />
      <Row
        label="VATSIM"
        value={stats.vatsimEnabled ? 'ON' : 'OFF'}
        status={stats.vatsimEnabled ? 'ok' : 'off'}
        tip="VATSIM live traffic overlay"
      />
      <Row
        label="IVAO"
        value={stats.ivaoEnabled ? 'ON' : 'OFF'}
        status={stats.ivaoEnabled ? 'ok' : 'off'}
        tip="IVAO live traffic overlay"
      />
    </div>
  );
}

function PerfPanel({ stats }: { stats: DebugStats }) {
  return (
    <div className="grid grid-cols-2 gap-x-6">
      <div>
        <SectionLabel>Rendering</SectionLabel>
        <Row
          label="FPS"
          value={String(stats.fps)}
          status={stats.fps >= 30 ? 'ok' : stats.fps >= 15 ? 'off' : 'error'}
          tip="Map render frames per second"
        />
        <Row
          label="Tile Cache"
          value={`${stats.tileCacheEntries} / ${stats.tileCacheSize}`}
          tip="Cached tiles: count / size"
        />
        <Row label="Hit Rate" value={stats.tileCacheHitRate} tip="Tile cache hit rate" />
      </div>
      <div>
        <SectionLabel>Memory</SectionLabel>
        <Row label="Renderer Heap" value={stats.rendererHeapMB} tip="Renderer process JS heap" />
        <Row label="Main Heap" value={stats.mainHeapMB} tip="Main process JS heap" />
        <Row label="Main RSS" value={stats.mainRssMB} tip="Main process total memory" />
        <Row
          label="IPC Latency"
          value={`${stats.ipcLatencyMs}ms`}
          status={stats.ipcLatencyMs <= 5 ? 'ok' : stats.ipcLatencyMs <= 20 ? 'off' : 'error'}
          tip="Round-trip IPC to main process"
        />
      </div>
    </div>
  );
}

function StatePanel() {
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
              className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-[10px] hover:bg-muted/40"
            >
              <span className="text-[8px]">{isExpanded ? '▾' : '▸'}</span>
              <span className="font-semibold uppercase tracking-wider text-foreground/70">
                {name}
              </span>
              <span className="ml-auto text-muted-foreground/40">{keys.length} keys</span>
            </button>
            {isExpanded && (
              <pre className="ml-3 overflow-x-auto border-l-2 border-border/30 pl-2 text-[10px] leading-relaxed text-foreground/60">
                {JSON.stringify(state, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

// --- Shared UI ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-0.5 mt-1 text-[9px] uppercase tracking-wider text-muted-foreground/40 first:mt-0">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  status,
  tip,
}: {
  label: string;
  value: string;
  status?: 'ok' | 'error' | 'off';
  tip?: string;
}) {
  const color =
    status === 'ok'
      ? 'text-success'
      : status === 'error'
        ? 'text-destructive'
        : status === 'off'
          ? 'text-warning'
          : 'text-foreground';

  return (
    <div className="flex justify-between gap-4 py-px" title={tip}>
      <span className="text-muted-foreground/70">{label}</span>
      <span className={`text-right ${color}`}>{value}</span>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-px" title={value}>
      <span className="shrink-0 text-muted-foreground/70">{label}</span>
      <span className="min-w-0 truncate text-foreground">{value}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-1.5 flex items-center gap-3 border-t border-border/30 pt-1.5 text-[9px] text-muted-foreground/40">
      <span className="flex items-center gap-1" title="Layer is rendering normally">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
        drawn
      </span>
      <span className="flex items-center gap-1" title="Hidden, out of zoom range, or loading">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
        warn
      </span>
      <span className="flex items-center gap-1" title="Empty source or missing source">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
        error
      </span>
    </div>
  );
}

// --- Layer Inspector ---

function StatusDot({ status }: { status: LayerStatus }) {
  const color =
    status === 'drawn'
      ? 'bg-success'
      : status === 'hidden' || status === 'out-of-range' || status === 'loading'
        ? 'bg-warning'
        : 'bg-destructive';
  const pulse = status === 'loading' ? 'animate-pulse' : '';
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color} ${pulse}`} />;
}

function OrderBadge({ order }: { order: number }) {
  return (
    <span
      className="inline-flex h-4 w-6 shrink-0 items-center justify-center rounded bg-muted/50 text-[9px] tabular-nums text-foreground/50"
      title={`Draw order ${order} — lower = behind, higher = on top`}
    >
      {order}
    </span>
  );
}

function InspectorGroup({ group, mapRef }: { group: LayerInspectorGroup; mapRef: MapRef }) {
  const [expanded, setExpanded] = useState(true);
  const label = group.category.charAt(0).toUpperCase() + group.category.slice(1);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[10px] text-muted-foreground/70 hover:text-foreground"
      >
        <span className="text-[8px]">{expanded ? '▾' : '▸'}</span>
        <span className="font-semibold uppercase tracking-wider">{label}</span>
        <span className="ml-auto tabular-nums">
          {group.drawnCount}/{group.totalCount}
        </span>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-px">
          {group.renderers.map((r) => (
            <RendererRow key={r.primaryLayerId} renderer={r} mapRef={mapRef} />
          ))}
        </div>
      )}
    </div>
  );
}

function RendererRow({ renderer, mapRef }: { renderer: RendererInfo; mapRef: MapRef }) {
  const [expanded, setExpanded] = useState(false);
  const hasSublayers = renderer.sublayers.length > 0;

  const stateTag =
    renderer.status === 'hidden'
      ? 'off'
      : renderer.status === 'out-of-range'
        ? 'oor'
        : renderer.status === 'loading'
          ? '...'
          : renderer.status === 'no-source'
            ? '!src'
            : renderer.status === 'empty'
              ? '0'
              : '';

  const countStr =
    renderer.featureCount > 0 ? `${renderer.approximate ? '~' : ''}${renderer.featureCount}` : '0';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const map = mapRef.current;
    if (!map) return;
    toggleRendererVisibility(map, renderer);
  };

  const handleExpand = () => {
    if (hasSublayers) setExpanded((v) => !v);
  };

  const isVisible = renderer.status !== 'hidden';

  return (
    <div>
      <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/40">
        <OrderBadge order={renderer.drawOrder} />
        <StatusDot status={renderer.status} />
        <span className="min-w-0 flex-1 truncate">{renderer.name}</span>
        <span className="shrink-0 tabular-nums text-foreground/40">{countStr}</span>
        {stateTag && stateTag !== 'off' && (
          <span className="shrink-0 rounded bg-muted/60 px-1 text-[9px] leading-tight text-warning">
            {stateTag}
          </span>
        )}
        {hasSublayers && (
          <button
            onClick={handleExpand}
            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
              expanded
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-foreground/60 hover:bg-muted/80'
            }`}
            title={expanded ? 'Collapse sublayers' : `Show ${renderer.sublayers.length} sublayers`}
          >
            {renderer.sublayers.length} {expanded ? '▴' : '▾'}
          </button>
        )}
        <button
          onClick={handleToggle}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
            isVisible
              ? 'bg-success/20 text-success hover:bg-success/30'
              : 'bg-destructive/20 text-destructive hover:bg-destructive/30'
          }`}
          title={isVisible ? 'Hide this layer' : 'Show this layer'}
        >
          {isVisible ? 'ON' : 'OFF'}
        </button>
      </div>
      {expanded && (
        <div className="ml-6 border-l-2 border-primary/30 pl-2">
          {renderer.sublayers.map((s) => (
            <SublayerRow key={s.layerId} sublayer={s} mapRef={mapRef} />
          ))}
        </div>
      )}
    </div>
  );
}

function SublayerRow({ sublayer, mapRef }: { sublayer: SublayerInfo; mapRef: MapRef }) {
  const handleToggle = () => {
    const map = mapRef.current;
    if (!map) return;
    toggleLayerVisibility(map, sublayer.layerId);
  };

  const isVisible = sublayer.status !== 'hidden';

  return (
    <div className="flex items-center gap-1 py-0.5 pl-1">
      <OrderBadge order={sublayer.drawOrder} />
      <StatusDot status={sublayer.status} />
      <span className="min-w-0 flex-1 truncate text-foreground/40">{sublayer.name}</span>
      <button
        onClick={handleToggle}
        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
          isVisible
            ? 'bg-success/20 text-success hover:bg-success/30'
            : 'bg-destructive/20 text-destructive hover:bg-destructive/30'
        }`}
        title={isVisible ? 'Hide' : 'Show'}
      >
        {isVisible ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
