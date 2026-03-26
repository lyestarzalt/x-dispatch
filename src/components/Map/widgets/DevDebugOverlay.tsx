import { useEffect, useRef, useState } from 'react';
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
}

type MapRef = React.RefObject<maplibregl.Map | null>;
type TabId = 'map' | 'layers' | 'network' | 'perf';

const TABS: { id: TabId; label: string; tip: string }[] = [
  { id: 'map', label: 'Map', tip: 'Map state, airport, terrain' },
  { id: 'layers', label: 'Layers', tip: 'Layer inspector — status, features, draw order' },
  { id: 'network', label: 'Net', tip: 'X-Plane WebSocket, VATSIM, IVAO' },
  { id: 'perf', label: 'Perf', tip: 'Memory, IPC latency, FPS, cache' },
];

// --- Main component ---

export default function DevDebugOverlay({ mapRef }: { mapRef: MapRef }) {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });

  // FPS counter via map render events
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

      const inspectorData = activeTab === 'layers' ? collectLayerInspectorData(map) : [];

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
      });
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mapRef, visible, activeTab]);

  // Toggle with Ctrl+Shift+D / Cmd+Shift+D
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

  const toggleTab = (id: TabId) => setActiveTab((prev) => (prev === id ? null : id));

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex select-none flex-col font-mono text-[11px] text-muted-foreground">
      {/* Toolbar */}
      <div className="flex items-center gap-px border-b border-white/[0.06] bg-background/70 px-2 py-0.5 backdrop-blur-xl">
        <span className="mr-2 text-[10px] font-semibold tracking-wider text-foreground/60">
          DEBUG
        </span>

        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => toggleTab(tab.id)}
            title={tab.tip}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Quick stats always visible in toolbar */}
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

      {/* Panel — drops down below toolbar when a tab is active */}
      {activeTab && stats && (
        <div className="max-h-[60vh] overflow-y-auto border-b border-white/[0.06] bg-background/70 px-3 py-2 shadow-lg backdrop-blur-xl">
          {activeTab === 'map' && <MapPanel stats={stats} />}
          {activeTab === 'layers' && <LayersPanel stats={stats} />}
          {activeTab === 'network' && <NetworkPanel stats={stats} />}
          {activeTab === 'perf' && <PerfPanel stats={stats} />}
        </div>
      )}
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
    </div>
  );
}

function LayersPanel({ stats }: { stats: DebugStats }) {
  if (stats.inspectorData.length === 0) {
    return <span className="text-muted-foreground/40">No app layers on map</span>;
  }
  return (
    <div className="space-y-1">
      {stats.inspectorData.map((group) => (
        <InspectorGroup key={group.category} group={group} />
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

function Legend() {
  return (
    <div className="mt-1.5 flex items-center gap-3 border-t border-white/[0.04] pt-1.5 text-[9px] text-muted-foreground/40">
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

function InspectorGroup({ group }: { group: LayerInspectorGroup }) {
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
            <RendererRow key={r.primaryLayerId} renderer={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RendererRow({ renderer }: { renderer: RendererInfo }) {
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

  return (
    <div className="pl-1">
      <div
        className="flex items-center gap-1 rounded px-1 py-px hover:bg-muted/40"
        role={hasSublayers ? 'button' : undefined}
        onClick={hasSublayers ? () => setExpanded((v) => !v) : undefined}
      >
        <span className="w-2 text-center text-[8px] text-muted-foreground/50">
          {hasSublayers ? (expanded ? '▾' : '▸') : ''}
        </span>
        <StatusDot status={renderer.status} />
        <span className="min-w-0 flex-1 truncate">{renderer.name}</span>
        {stateTag && (
          <span className="shrink-0 rounded bg-muted/60 px-1 text-[9px] leading-tight text-warning">
            {stateTag}
          </span>
        )}
        <span className="shrink-0 tabular-nums text-foreground/40">{countStr}</span>
        <span
          className="shrink-0 tabular-nums text-foreground/20"
          title="Draw order (lower = behind, higher = on top)"
        >
          #{renderer.drawOrder}
        </span>
      </div>
      {expanded && (
        <div className="ml-3 border-l border-border/20 pl-1.5">
          {renderer.sublayers.map((s) => (
            <SublayerRow key={s.layerId} sublayer={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SublayerRow({ sublayer }: { sublayer: SublayerInfo }) {
  return (
    <div className="flex items-center gap-1 py-px pl-1">
      <StatusDot status={sublayer.status} />
      <span className="min-w-0 flex-1 truncate text-foreground/40">{sublayer.name}</span>
      <span
        className="shrink-0 tabular-nums text-foreground/20"
        title="Draw order (lower = behind, higher = on top)"
      >
        #{sublayer.drawOrder}
      </span>
    </div>
  );
}
