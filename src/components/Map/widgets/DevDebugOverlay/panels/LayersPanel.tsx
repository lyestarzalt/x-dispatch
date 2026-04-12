import { useState } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LayerInspectorGroup, RendererInfo, SublayerInfo } from '../../layerInspector';
import { Legend, OrderBadge, StatusDot } from '../shared';
import type { DebugStats, MapRef } from '../types';

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

// --- LayersPanel ---

export function LayersPanel({ stats, mapRef }: { stats: DebugStats; mapRef: MapRef }) {
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

// --- InspectorGroup ---

function InspectorGroup({ group, mapRef }: { group: LayerInspectorGroup; mapRef: MapRef }) {
  const [expanded, setExpanded] = useState(true);
  const label = group.category.charAt(0).toUpperCase() + group.category.slice(1);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-sm text-muted-foreground/70 hover:text-foreground"
      >
        <span className="text-xs">{expanded ? '▾' : '▸'}</span>
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

// --- RendererRow ---

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
          <span className="shrink-0 rounded bg-muted/60 px-1 text-sm leading-tight text-warning">
            {stateTag}
          </span>
        )}
        {hasSublayers && (
          <button
            onClick={handleExpand}
            className={`shrink-0 rounded px-1.5 py-0.5 text-sm font-bold ${
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
          className={`shrink-0 rounded px-1.5 py-0.5 text-sm font-bold ${
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

// --- SublayerRow ---

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
        className={`shrink-0 rounded px-1.5 py-0.5 text-sm font-bold ${
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
