import { useEffect, useState } from 'react';
import { Row, SectionLabel } from '../shared';
import type { DebugStats, MapRef } from '../types';

interface MapLibreDebugFlag {
  key: 'showOverdrawInspector' | 'showTileBoundaries' | 'showCollisionBoxes' | 'showPadding';
  label: string;
  tip: string;
}

const MAPLIBRE_FLAGS: MapLibreDebugFlag[] = [
  {
    key: 'showOverdrawInspector',
    label: 'Overdraw',
    tip: 'Pixels painted multiple times glow brighter — find expensive layers',
  },
  {
    key: 'showTileBoundaries',
    label: 'Tile borders',
    tip: 'Show raster/vector tile boundaries with z/x/y labels',
  },
  {
    key: 'showCollisionBoxes',
    label: 'Collision boxes',
    tip: 'Show symbol/label collision rectangles',
  },
  {
    key: 'showPadding',
    label: 'Camera padding',
    tip: 'Show the camera padding rectangle',
  },
];

function ToggleRow({
  label,
  value,
  onChange,
  tip,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tip?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-px" title={tip}>
      <span className="text-muted-foreground/70">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 cursor-pointer accent-primary"
      />
    </label>
  );
}

export function PerfPanel({ stats, mapRef }: { stats: DebugStats; mapRef: MapRef }) {
  const [flags, setFlags] = useState<Record<MapLibreDebugFlag['key'], boolean>>(() => ({
    showOverdrawInspector: false,
    showTileBoundaries: false,
    showCollisionBoxes: false,
    showPadding: false,
  }));

  // Sync from the live map on mount so the checkboxes reflect whatever's
  // currently set (e.g. if the user toggled via DevTools console).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = Object.create(null) as Record<MapLibreDebugFlag['key'], boolean>;
    for (const { key } of MAPLIBRE_FLAGS) {
      next[key] = Boolean((map as unknown as Record<string, unknown>)[key]);
    }
    setFlags(next);
  }, [mapRef]);

  const setFlag = (key: MapLibreDebugFlag['key'], value: boolean) => {
    const map = mapRef.current;
    if (map) (map as unknown as Record<string, unknown>)[key] = value;
    setFlags((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <SectionLabel>Tile Cache</SectionLabel>
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
      <div>
        <SectionLabel>MapLibre Debug</SectionLabel>
        {MAPLIBRE_FLAGS.map(({ key, label, tip }) => (
          <ToggleRow
            key={key}
            label={label}
            tip={tip}
            value={flags[key]}
            onChange={(v) => setFlag(key, v)}
          />
        ))}
      </div>
    </div>
  );
}
