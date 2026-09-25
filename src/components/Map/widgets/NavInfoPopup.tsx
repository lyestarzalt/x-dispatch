import { type RefObject, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calculateBearing, distanceNm } from '@/lib/utils/geomath';
import { type NavInfoSelection, useMapStore } from '@/stores/mapStore';
import { usePlaneStore } from '@/stores/planeStore';

const POPUP_OFFSET_PX = 14;

interface NavInfoPopupProps {
  mapRef: RefObject<maplibregl.Map | null>;
}

/** Card anchored to a clicked navaid or waypoint, with live bearing and distance from the aircraft. */
export default function NavInfoPopup({ mapRef }: NavInfoPopupProps) {
  const info = useMapStore((s) => s.navInfo);
  const setNavInfo = useMapStore((s) => s.setNavInfo);
  const container = useMemo(() => document.createElement('div'), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !info) return;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      className: 'nav-info-popup',
      maxWidth: 'none',
      offset: POPUP_OFFSET_PX,
    })
      .setLngLat([info.longitude, info.latitude])
      .setDOMContent(container)
      .addTo(map);
    // A click on another feature replaces the selection before this popup closes.
    popup.on('close', () => {
      if (useMapStore.getState().navInfo === info) setNavInfo(null);
    });
    return () => {
      popup.remove();
    };
  }, [info, mapRef, container, setNavInfo]);

  if (!info) return null;
  return createPortal(<NavInfoCard info={info} onClose={() => setNavInfo(null)} />, container);
}

function formatDeg(deg: number): string {
  return `${String(Math.round(deg) % 360).padStart(3, '0')}°`;
}

function NavInfoCard({ info, onClose }: { info: NavInfoSelection; onClose: () => void }) {
  const { t } = useTranslation();
  const plane = usePlaneStore((s) => s.state);

  const bearing = plane
    ? calculateBearing(plane.latitude, plane.longitude, info.latitude, info.longitude)
    : null;
  const distance = plane
    ? distanceNm(plane.latitude, plane.longitude, info.latitude, info.longitude)
    : null;
  const isNavaid = info.kind !== 'WPT';

  return (
    <div className="border-border/50 bg-card/95 w-56 rounded-xl border p-3 text-xs shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-info font-mono text-sm font-bold">{info.id}</span>
            <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[10px]">
              {info.kind === 'WPT' ? t('navInfo.waypoint') : info.kind}
            </Badge>
          </div>
          {info.name && <div className="text-muted-foreground truncate">{info.name}</div>}
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-1 h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {info.frequency && <Row label={t('navInfo.frequency')} value={info.frequency} />}
        {info.altitudeLabel && <Row label={t('navInfo.altitude')} value={info.altitudeLabel} />}
        {bearing !== null && distance !== null ? (
          <>
            <Row label={t('navInfo.bearingTrue')} value={formatDeg(bearing)} accent />
            {isNavaid && <Row label={t('navInfo.radial')} value={formatDeg(bearing + 180)} />}
            <Row
              label={t('navInfo.distance')}
              value={`${distance < 10 ? distance.toFixed(1) : Math.round(distance)} ${t('units.nm')}`}
              accent
            />
          </>
        ) : (
          <div className="text-muted-foreground col-span-2">{t('navInfo.noPlane')}</div>
        )}
      </dl>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={accent ? 'text-primary font-mono tabular-nums' : 'font-mono tabular-nums'}>
        {value}
      </dd>
    </>
  );
}
