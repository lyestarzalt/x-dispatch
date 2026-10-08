import { type RefObject, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouteProfile } from '@/hooks/useRouteProfile';
import { useUnits } from '@/hooks/useUnits';
import { type Degrees, type Feet, calculateBearing, distanceNm } from '@/lib/utils/geomath';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { type NavInfoSelection, useMapStore } from '@/stores/mapStore';
import { usePlaneStore } from '@/stores/planeStore';
import { plannedAltitudeFt } from '../navInfo';

const POPUP_OFFSET_PX = 14;

interface NavInfoPopupProps {
  mapRef: RefObject<maplibregl.Map | null>;
  airports: Airport[];
}

/** Card anchored to a clicked navaid or waypoint, with live bearing and distance from the aircraft. */
export default function NavInfoPopup({ mapRef, airports }: NavInfoPopupProps) {
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
  return createPortal(
    <NavInfoCard info={info} airports={airports} onClose={() => setNavInfo(null)} />,
    container
  );
}

interface NavInfoCardProps {
  info: NavInfoSelection;
  airports: Airport[];
  onClose: () => void;
}

function NavInfoCard({ info, airports, onClose }: NavInfoCardProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const plane = usePlaneStore((s) => s.state);
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const { profile } = useRouteProfile(airports);
  const plannedFt = fmsData
    ? plannedAltitudeFt(info, fmsData.waypoints, profile?.altitudesFt ?? [])
    : null;
  const altitude = plannedFt !== null ? units.altitude(plannedFt as Feet) : info.altitudeLabel;

  const bearing = plane
    ? calculateBearing(plane.latitude, plane.longitude, info.latitude, info.longitude)
    : null;
  const distance = plane
    ? distanceNm(plane.latitude, plane.longitude, info.latitude, info.longitude)
    : null;
  const isNavaid = info.kind !== 'WPT';

  return (
    <div className="border-border/50 bg-card/95 w-56 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-xl">
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
        <Button variant="ghost" size="icon-xs" className="-mt-1 -mr-1" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {info.frequency && <Row label={t('navInfo.frequency')} value={info.frequency} />}
        {info.runway && <Row label={t('navInfo.runway')} value={info.runway} />}
        {info.courseTrue !== undefined && (
          <Row
            label={t('navInfo.course')}
            value={units.course(info.courseTrue as Degrees, info.latitude, info.longitude)}
          />
        )}
        {altitude && <Row label={t('navInfo.altitude')} value={altitude} accent />}
        {info.elevationFt !== undefined && (
          <Row label={t('navInfo.elevation')} value={units.altitude(info.elevationFt as Feet)} />
        )}
        {bearing !== null && distance !== null ? (
          <>
            <Row
              label={t('navInfo.bearing')}
              value={units.course(bearing, info.latitude, info.longitude)}
              accent
            />
            {isNavaid && (
              <Row
                label={t('navInfo.radial')}
                value={units.course(
                  ((bearing + 180) % 360) as Degrees,
                  info.latitude,
                  info.longitude
                )}
              />
            )}
            <Row label={t('navInfo.distance')} value={units.distance(distance)} accent />
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
