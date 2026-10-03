import { type RefObject, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import { useUnits } from '@/hooks/useUnits';
import { greatCircleMidpoint } from '@/lib/measure/geodesic';
import { measureLegs } from '@/lib/measure/measureGeometry';
import { type MeasureGeometry, buildMeasureLabel } from '@/lib/measure/measureLabel';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { type MeasureLine, type MeasurePoint, useMeasureStore } from '@/stores/measureStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface MeasureLabelProps {
  mapRef: RefObject<maplibregl.Map | null>;
}

/** Projected legs shorter than this get no label; the line alone shows the direction. */
const MIN_LABEL_LENGTH_PX = 48;

interface Placement {
  rotation: number;
  flipped: boolean;
  hidden: boolean;
}

const HIDDEN: Placement = { rotation: 0, flipped: false, hidden: true };

/** Screen angle of a leg and whether the text had to be flipped to stay upright. */
function placementFor(map: maplibregl.Map, from: MeasurePoint, to: MeasurePoint): Placement {
  const a = map.project([from.longitude, from.latitude]);
  const b = map.project([to.longitude, to.latitude]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const hidden = Math.hypot(dx, dy) < MIN_LABEL_LENGTH_PX;
  let rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  const flipped = rotation > 90 || rotation < -90;
  if (flipped) rotation += 180;
  return { rotation, flipped, hidden };
}

/** One label per leg of the measurement line, plus a total and a clear button on the last. */
export default function MeasureLabel({ mapRef }: MeasureLabelProps) {
  const line = useMeasureStore((s) => s.draft ?? s.line);
  const placing = useMeasureStore((s) => s.placing);
  if (!line) return null;
  const { legs, totalNm } = measureLegs(line);
  return (
    <>
      {legs.map((leg, i) => (
        <LegLabel
          key={i}
          mapRef={mapRef}
          line={line}
          index={i}
          geometry={leg}
          placing={placing && i === legs.length - 1}
          isLast={i === legs.length - 1}
          totalNm={legs.length > 1 ? totalNm : null}
        />
      ))}
    </>
  );
}

interface LegLabelProps {
  mapRef: RefObject<maplibregl.Map | null>;
  line: MeasureLine;
  index: number;
  geometry: MeasureGeometry;
  placing: boolean;
  isLast: boolean;
  totalNm: NauticalMiles | null;
}

function LegLabel({ mapRef, line, index, geometry, placing, isLast, totalNm }: LegLabelProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const unitPrefs = useSettingsStore((s) => s.map.units);
  const clear = useMeasureStore((s) => s.clear);
  const container = useMemo(() => document.createElement('div'), []);
  const [placement, setPlacement] = useState<Placement>(HIDDEN);
  const from = line.points[index];
  const to = line.points[index + 1];

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !from || !to) return;
    const marker = new maplibregl.Marker({
      element: container,
      anchor: 'center',
      rotationAlignment: 'viewport',
      pitchAlignment: 'viewport',
    })
      .setLngLat(greatCircleMidpoint([from.longitude, from.latitude], [to.longitude, to.latitude]))
      .addTo(map);

    const update = () => {
      const next = placementFor(map, from, to);
      marker.setRotation(next.rotation);
      setPlacement((prev) =>
        prev.rotation === next.rotation &&
        prev.flipped === next.flipped &&
        prev.hidden === next.hidden
          ? prev
          : next
      );
    };
    update();
    map.on('move', update);
    return () => {
      map.off('move', update);
      marker.remove();
    };
  }, [mapRef, container, from, to]);

  const lines = useMemo(
    () =>
      buildMeasureLabel(
        geometry,
        {
          courseMode: unitPrefs.course,
          distanceUnit: unitPrefs.distance,
          shortUnit: unitPrefs.altitude,
          placing,
          flipped: placement.flipped,
        },
        t
      ),
    [geometry, unitPrefs, placing, placement.flipped, t]
  );

  if (placement.hidden || lines.length === 0) return null;
  return createPortal(
    <div
      className={cn(
        'bg-popover/90 text-popover-foreground border-border pointer-events-none relative rounded-sm border px-1.5 py-0.5',
        'text-center font-mono text-xs whitespace-nowrap tabular-nums'
      )}
    >
      {lines.map((text) => (
        <div key={text}>{text}</div>
      ))}
      {isLast && totalNm !== null && (
        <div className="text-muted-foreground">
          {t('mapContextMenu.measureTotal', { value: units.distance(totalNm) })}
        </div>
      )}
      {isLast && !placing && (
        <button
          type="button"
          onClick={clear}
          aria-label={t('mapContextMenu.clearMeasurement')}
          className="bg-popover border-border text-muted-foreground hover:text-foreground pointer-events-auto absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full border"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>,
    container
  );
}
