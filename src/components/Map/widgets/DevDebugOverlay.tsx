import { useCallback, useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { collectLayerInspectorData } from './layerInspector';
import type {
  LayerInspectorGroup,
  LayerStatus,
  RendererInfo,
  SublayerInfo,
} from './layerInspector';

interface DebugStats {
  // App
  appVersion: string;
  env: string;
  electronVersion: string;
  chromeVersion: string;

  // Map
  zoom: number;
  pitch: number;
  projection: string;
  center: [number, number];
  fps: number;
  layerCount: number;
  sourceCount: number;

  // Airport
  airportICAO: string | null;
  airportSource: string;

  // Layer Inspector
  inspectorData: LayerInspectorGroup[];

  // Terrain
  terrainActive: boolean;
  terrainSourceLoaded: boolean;
  hillshadeSourceLoaded: boolean;

  // Cache
  tileCacheEntries: number;
  tileCacheSize: string;
  tileCacheHitRate: string;

  // Network
  xplaneWs: string;
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;

  // Performance
  rendererHeapMB: string;
  mainRssMB: string;
  mainHeapMB: string;
  ipcLatencyMs: number;
}

type MapRef = React.RefObject<maplibregl.Map | null>;

// --- Drag hook ---

function useDrag(initialPos: { x: number; y: number }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag from the title bar area
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

  return { pos, onMouseDown };
}

export default function DevDebugOverlay({ mapRef }: { mapRef: MapRef }) {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [visible, setVisible] = useState(false);
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), fps: 0 });
  const { pos, onMouseDown } = useDrag({ x: 12, y: window.innerHeight - 400 });

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

      // App info
      let appVersion = '—';
      try {
        appVersion = await window.appAPI.getVersion();
      } catch {
        // ignore
      }

      // IPC latency
      let ipcLatencyMs = 0;
      try {
        const start = performance.now();
        await window.appAPI.getVersion();
        ipcLatencyMs = Math.round(performance.now() - start);
      } catch {
        // ignore
      }

      // Main process memory
      let mainRssMB = '—';
      let mainHeapMB = '—';
      try {
        const mainMem = await window.appAPI.getProcessMemory();
        mainRssMB = `${(mainMem.rss / 1024 / 1024).toFixed(0)}MB`;
        mainHeapMB = `${(mainMem.heapUsed / 1024 / 1024).toFixed(0)}MB`;
      } catch {
        // ignore
      }

      // Tile cache
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
        // ignore
      }

      // X-Plane WebSocket
      let xplaneWs = 'off';
      try {
        const connected = await window.xplaneServiceAPI.isStreamConnected();
        xplaneWs = connected ? 'connected' : 'disconnected';
      } catch {
        // ignore
      }

      // Renderer heap
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const rendererHeapMB = mem ? `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(0)}MB` : '—';

      // Store state
      const { useMapStore } = await import('@/stores/mapStore');
      const { vatsimEnabled, ivaoEnabled } = useMapStore.getState();

      const { useAppStore } = await import('@/stores/appStore');
      const { selectedICAO, selectedAirportIsCustom } = useAppStore.getState();

      // Layer inspector (only compute when expanded)
      const inspectorData = inspectorExpanded ? collectLayerInspectorData(map) : [];

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
  }, [mapRef, visible, inspectorExpanded]);

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

  if (!visible || !stats) return null;

  return (
    <div
      className="fixed z-50 max-h-[70vh] w-72 select-none overflow-y-auto rounded-lg border border-white/[0.08] bg-background/70 font-mono text-[11px] text-muted-foreground shadow-2xl backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Title bar — draggable */}
      <div
        onMouseDown={onMouseDown}
        className="sticky top-0 z-10 flex cursor-grab items-center justify-between border-b border-white/[0.06] bg-background/60 px-3 py-1.5 backdrop-blur-xl active:cursor-grabbing"
      >
        <span className="text-xs font-semibold tracking-wide text-foreground">Debug</span>
        <button
          onClick={() => setVisible(false)}
          className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-1.5">
        {/* App */}
        <Row
          label="Version"
          value={`v${stats.appVersion} ${stats.env === 'production' ? '' : '(dev)'}`}
          tip="App version and environment (production or development)"
        />
        <Row
          label="Electron"
          value={`${stats.electronVersion} / Cr ${stats.chromeVersion}`}
          tip="Electron framework version / Chromium engine version"
        />

        {/* Map */}
        <Section label="Map" />
        <Row
          label="Zoom"
          value={stats.zoom.toFixed(2)}
          tip="Current map zoom level (0 = world, 20 = building)"
        />
        <Row
          label="Center"
          value={`${stats.center[1].toFixed(3)}, ${stats.center[0].toFixed(3)}`}
          tip="Map center coordinates (lat, lng)"
        />
        <Row
          label="FPS"
          value={String(stats.fps)}
          status={stats.fps >= 30 ? 'ok' : stats.fps >= 15 ? 'off' : 'error'}
          tip="Map render frames per second. Green ≥30, yellow ≥15, red <15"
        />
        <Row
          label="Layers / Src"
          value={`${stats.layerCount} / ${stats.sourceCount}`}
          tip="Total MapLibre layers / data sources (includes base map)"
        />

        {/* Airport */}
        <Row
          label="Airport"
          value={stats.airportICAO ? `${stats.airportICAO} (${stats.airportSource})` : 'none'}
          status={stats.airportSource === 'custom' ? 'ok' : undefined}
          tip="Selected airport ICAO code and scenery source (default or custom)"
        />

        {/* Layer Inspector */}
        <button
          onClick={() => setInspectorExpanded((v) => !v)}
          title="Expand to inspect all app layer renderers, their status, and feature counts"
          className="mt-2 flex w-full items-center gap-1.5 rounded border border-border/40 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/50 hover:text-foreground"
        >
          <span className="text-[8px]">{inspectorExpanded ? '▾' : '▸'}</span>
          <span>Layer Inspector</span>
          <span className="ml-auto text-foreground/40">
            {stats.inspectorData.reduce((n, g) => n + g.drawnCount, 0)}/
            {stats.inspectorData.reduce((n, g) => n + g.totalCount, 0)}
          </span>
        </button>
        {inspectorExpanded &&
          stats.inspectorData.map((group) => <InspectorGroup key={group.category} group={group} />)}

        {/* Terrain */}
        <Section label="Terrain" />
        <Row
          label="3D / DEM / Hill"
          value={`${stats.terrainActive ? 'ON' : 'OFF'} / ${stats.terrainSourceLoaded ? 'ok' : '!'} / ${stats.hillshadeSourceLoaded ? 'ok' : '!'}`}
          status={stats.terrainActive && stats.terrainSourceLoaded ? 'ok' : 'error'}
          tip="3D terrain extrusion / DEM elevation source / Hillshade source"
        />

        {/* Cache */}
        <Row
          label="Tile Cache"
          value={`${stats.tileCacheEntries} / ${stats.tileCacheSize} (${stats.tileCacheHitRate})`}
          tip="Cached map tiles: count / disk size (hit rate)"
        />

        {/* Network */}
        <Section label="Network" />
        <Row
          label="X-Plane WS"
          value={stats.xplaneWs}
          status={
            stats.xplaneWs === 'connected' ? 'ok' : stats.xplaneWs === 'off' ? 'off' : 'error'
          }
          tip="WebSocket connection to X-Plane for live flight data"
        />
        <Row
          label="VATSIM / IVAO"
          value={`${stats.vatsimEnabled ? 'ON' : 'OFF'} / ${stats.ivaoEnabled ? 'ON' : 'OFF'}`}
          status={stats.vatsimEnabled || stats.ivaoEnabled ? 'ok' : 'off'}
          tip="Online network overlays — shows live pilot traffic"
        />

        {/* Performance */}
        <Section label="Perf" />
        <Row
          label="Heap"
          value={`${stats.rendererHeapMB} render / ${stats.mainHeapMB} main`}
          tip="JS heap usage: renderer process / main (Electron) process"
        />
        <Row
          label="Main RSS"
          value={stats.mainRssMB}
          tip="Main process resident set size — total memory footprint"
        />
        <Row
          label="IPC"
          value={`${stats.ipcLatencyMs}ms`}
          status={stats.ipcLatencyMs <= 5 ? 'ok' : stats.ipcLatencyMs <= 20 ? 'off' : 'error'}
          tip="Round-trip time for an IPC call to main process. Green ≤5ms, yellow ≤20ms, red >20ms"
        />

        {/* Legend */}
        <div className="mt-2 flex items-center gap-3 border-t border-white/[0.04] pt-1.5 text-[9px] text-muted-foreground/50">
          <span className="flex items-center gap-1" title="Value is normal">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            ok
          </span>
          <span
            className="flex items-center gap-1"
            title="Value needs attention — degraded or disabled"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
            warn
          </span>
          <span className="flex items-center gap-1" title="Value indicates a problem">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
            error
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Shared UI components ---

function Section({
  label,
  collapsible,
  expanded,
  onToggle,
}: {
  label: string;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  if (collapsible) {
    return (
      <button
        onClick={onToggle}
        className="mt-2 flex w-full items-center gap-1.5 border-t border-border/30 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground"
      >
        <span className="text-[8px]">{expanded ? '▾' : '▸'}</span>
        {label}
      </button>
    );
  }
  return (
    <div className="mt-2 border-t border-border/30 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
      {label}
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
      <span className="text-muted-foreground/80">{label}</span>
      <span className={`text-right ${color}`}>{value}</span>
    </div>
  );
}

// --- Layer Inspector UI ---

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
    <div className="mt-1.5">
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
    </div>
  );
}
