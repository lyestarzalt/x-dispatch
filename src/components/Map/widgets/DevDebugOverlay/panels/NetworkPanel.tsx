import { Row } from '../shared';
import type { DebugStats } from '../types';

export function NetworkPanel({ stats }: { stats: DebugStats }) {
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
