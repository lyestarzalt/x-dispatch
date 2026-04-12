import { Row, SectionLabel } from '../shared';
import type { DebugStats } from '../types';

export function PerfPanel({ stats }: { stats: DebugStats }) {
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
