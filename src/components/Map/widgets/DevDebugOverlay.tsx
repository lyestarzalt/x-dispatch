import { useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';

interface DebugStats {
  // Map
  zoom: number;
  pitch: number;
  projection: string;
  center: [number, number];
  fps: number;
  layerCount: number;
  sourceCount: number;
  styleVersion: number;

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
  heapMB: string;
}

type MapRef = React.RefObject<maplibregl.Map | null>;

export default function DevDebugOverlay({ mapRef }: { mapRef: MapRef }) {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [visible, setVisible] = useState(false);
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

      // Heap
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const heapMB = mem ? `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(0)}MB` : '—';

      // Store state
      const { useMapStore } = await import('@/stores/mapStore');
      const { styleVersion, vatsimEnabled, ivaoEnabled } = useMapStore.getState();

      setStats({
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        projection: (proj as { type?: string })?.type ?? 'unknown',
        center: [map.getCenter().lng, map.getCenter().lat],
        fps: fpsRef.current.fps,
        layerCount: style?.layers?.length ?? 0,
        sourceCount: style?.sources ? Object.keys(style.sources).length : 0,
        styleVersion,
        terrainActive: map.getTerrain() != null,
        terrainSourceLoaded: !!map.getSource('terrain-dem'),
        hillshadeSourceLoaded: !!map.getSource('terrain-hillshade-dem'),
        tileCacheEntries,
        tileCacheSize,
        tileCacheHitRate,
        xplaneWs,
        vatsimEnabled,
        ivaoEnabled,
        heapMB,
      });
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mapRef, visible]);

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Only available in dev mode
  if (process.env.NODE_ENV === 'production') return null;
  if (!visible || !stats) return null;

  return (
    <div className="absolute bottom-14 left-3 z-40 select-none rounded border border-border/50 bg-background/90 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-foreground">Debug</span>
        <button
          onClick={() => setVisible(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>

      {/* Map */}
      <Section label="Map" />
      <Row label="Zoom" value={stats.zoom.toFixed(2)} />
      <Row label="Pitch" value={`${stats.pitch.toFixed(0)}°`} />
      <Row label="Proj" value={stats.projection} />
      <Row label="Center" value={`${stats.center[1].toFixed(3)}, ${stats.center[0].toFixed(3)}`} />
      <Row
        label="FPS"
        value={String(stats.fps)}
        status={stats.fps >= 30 ? 'ok' : stats.fps >= 15 ? 'off' : 'error'}
      />
      <Row label="Layers" value={String(stats.layerCount)} />
      <Row label="Sources" value={String(stats.sourceCount)} />
      <Row label="Style v" value={String(stats.styleVersion)} />

      {/* Terrain */}
      <Section label="Terrain" />
      <Row
        label="3D Extrusion"
        value={stats.terrainActive ? 'ON' : 'OFF'}
        status={stats.terrainActive ? 'ok' : 'off'}
      />
      <Row
        label="DEM Src"
        value={stats.terrainSourceLoaded ? 'loaded' : 'missing'}
        status={stats.terrainSourceLoaded ? 'ok' : 'error'}
      />
      <Row
        label="Hillshade Src"
        value={stats.hillshadeSourceLoaded ? 'loaded' : 'missing'}
        status={stats.hillshadeSourceLoaded ? 'ok' : 'error'}
      />

      {/* Cache */}
      <Section label="Cache" />
      <Row label="Tiles" value={`${stats.tileCacheEntries} / ${stats.tileCacheSize}`} />
      <Row label="Hit Rate" value={stats.tileCacheHitRate} />

      {/* Network */}
      <Section label="Network" />
      <Row
        label="X-Plane WS"
        value={stats.xplaneWs}
        status={stats.xplaneWs === 'connected' ? 'ok' : stats.xplaneWs === 'off' ? 'off' : 'error'}
      />
      <Row
        label="VATSIM"
        value={stats.vatsimEnabled ? 'ON' : 'OFF'}
        status={stats.vatsimEnabled ? 'ok' : 'off'}
      />
      <Row
        label="IVAO"
        value={stats.ivaoEnabled ? 'ON' : 'OFF'}
        status={stats.ivaoEnabled ? 'ok' : 'off'}
      />

      {/* Performance */}
      <Section label="Perf" />
      <Row label="JS Heap" value={stats.heapMB} />
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="mt-1.5 border-t border-border/30 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
      {label}
    </div>
  );
}

function Row({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: 'ok' | 'error' | 'off';
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
    <div className="flex justify-between gap-6">
      <span>{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
