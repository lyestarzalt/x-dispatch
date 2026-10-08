import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Mountain, X } from 'lucide-react';
import { useDragPosition } from '@/components/Map/hooks/useDragPosition';
import {
  VerticalProfileChart,
  type VerticalProfileRow,
} from '@/components/profile/VerticalProfileChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouteProfile } from '@/hooks/useRouteProfile';
import { useUnits } from '@/hooks/useUnits';
import { bearingDeg } from '@/lib/flightplan/builder/geometry';
import type { Feet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useMapStore } from '@/stores/mapStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';

interface ProfileStripProps {
  airports: Airport[];
}

/**
 * The vertical profile of the plan on the map. Sits along the bottom edge by default; drag its
 * header to move it anywhere, double-click the header to put it back.
 */
function ProfileStrip({ airports }: ProfileStripProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const open = useMapStore((s) => s.profileStripOpen);
  const setOpen = useMapStore((s) => s.setProfileStripOpen);
  const storedPosition = useMapStore((s) => s.profileStripPosition);
  const setPosition = useMapStore((s) => s.setProfileStripPosition);
  const setProfileHover = useMapStore((s) => s.setProfileHover);
  const { stripRef, position, handleMouseDown, handleDoubleClick } = useDragPosition(
    storedPosition,
    setPosition
  );
  const builderOpen = usePlanBuilderStore((s) => s.isOpen);
  const view = useRouteProfile(airports);
  const handleHover = useCallback(
    (row: VerticalProfileRow | null, next: VerticalProfileRow | null) => {
      if (!row || row.latitude === undefined || row.longitude === undefined) {
        setProfileHover(null);
        return;
      }
      const here = { latitude: row.latitude, longitude: row.longitude };
      const ahead =
        next && next.latitude !== undefined && next.longitude !== undefined
          ? { latitude: next.latitude, longitude: next.longitude }
          : null;
      setProfileHover({
        ...here,
        altitudeFt: row.altitude,
        headingDeg: ahead ? bearingDeg(here, ahead) : 0,
      });
    },
    [setProfileHover]
  );

  if (!view.hasPlan || !open) return null;

  const isDefault = position === null;
  const errors = view.profile?.errors ?? [];
  const blocking = errors.filter((e) => e !== 'cruiseNotReached');
  let message: string | null = null;
  if (view.cruiseFt === null) message = t('profile.noCruise');
  else if (blocking.includes('tooShort')) message = t('profile.tooShort');
  else if (blocking.includes('cruiseTooLow')) message = t('profile.cruiseTooLow');

  return (
    <div
      ref={stripRef}
      className={cn(
        'z-20 select-none',
        // Default place: along the bottom, centred; beside the docked planner while it is open.
        isDefault &&
          !builderOpen &&
          'absolute bottom-4 left-1/2 w-[min(1200px,calc(100vw-16rem))] -translate-x-1/2',
        isDefault && builderOpen && 'absolute right-4 bottom-4 left-[28rem]',
        !isDefault && 'fixed w-[min(1200px,calc(100vw-16rem))]'
      )}
      style={!isDefault ? { left: position.x, top: position.y } : undefined}
    >
      <div className="border-border/50 bg-card/90 rounded-xl border p-2 shadow-xl backdrop-blur-xl">
        <div
          className="mb-1 flex min-w-0 cursor-grab items-center gap-2 px-1 active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <GripVertical className="text-muted-foreground/60 h-4 w-4 shrink-0" />
          <Mountain className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="xp-section-heading truncate">{t('profile.title')}</span>
          {view.routeSafeFt !== null && (
            <Badge variant="destructive" className="text-2xs shrink-0 font-mono">
              {t('profile.safeAltitude')} {units.altitude(view.routeSafeFt as Feet)}
            </Badge>
          )}
          {errors.includes('cruiseNotReached') && (
            <Badge variant="warning" className="text-2xs min-w-0 truncate">
              {t('profile.cruiseNotReached')}
            </Badge>
          )}
          {view.isLoadingTerrain && (
            <span className="text-muted-foreground flex items-center gap-2 truncate text-xs">
              {t('profile.loadingTerrain')}
              {view.terrainProgress && view.terrainProgress.total > 0 && (
                <Progress
                  className="h-1.5 w-20"
                  value={Math.round((100 * view.terrainProgress.done) / view.terrainProgress.total)}
                />
              )}
            </span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setOpen(false)}
            aria-label={t('profile.hide')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {message ? (
          <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
            {message}
          </div>
        ) : (
          <VerticalProfileChart
            rows={view.rows}
            tocDistance={view.profile?.tocDistanceNm ?? null}
            todDistance={view.profile?.todDistanceNm ?? null}
            safeAltitudeFt={view.routeSafeFt}
            className="h-56"
            compact
            onHover={handleHover}
          />
        )}
      </div>
    </div>
  );
}

export default memo(ProfileStrip);
