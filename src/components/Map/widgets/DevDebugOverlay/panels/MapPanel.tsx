import { PathRow, Row, SectionLabel } from '../shared';
import type { DebugStats } from '../types';

export function MapPanel({ stats }: { stats: DebugStats }) {
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
