import { type RefObject, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Crosshair, MapPin, Ruler, Trash2 } from 'lucide-react';
import type * as maplibregl from 'maplibre-gl';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUnits } from '@/hooks/useUnits';
import { trackEvent } from '@/queries/useAnalytics';
import { useMapStore } from '@/stores/mapStore';
import { useMeasureStore } from '@/stores/measureStore';
import { buildContextPointLabels } from './contextPointLabels';

interface MapContextMenuProps {
  mapRef: RefObject<maplibregl.Map | null>;
  /** Places the Start Anywhere pin at the point (no camera move). */
  onStartHere: (lat: number, lon: number) => void;
}

/**
 * Right-click menu over the map. `useMapContextMenu` (run by the Map
 * component once the map exists) publishes the clicked point to the store;
 * this widget only renders it. A DropdownMenu with a zero-size trigger
 * pinned at the click pixel gives context-menu placement without a second
 * trigger fighting the map for the native event.
 */
export default function MapContextMenu({ mapRef, onStartHere }: MapContextMenuProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const point = useMapStore((s) => s.contextMenuPoint);
  const setContextMenuPoint = useMapStore((s) => s.setContextMenuPoint);

  const labels = useMemo(
    () =>
      point
        ? buildContextPointLabels(point.latitude, point.longitude, point.elevationM, units)
        : null,
    [point, units]
  );

  const handleCopy = useCallback(async () => {
    if (!labels) return;
    trackEvent('context_menu_used', { action: 'copy_coordinates' });
    await window.appAPI.clipboardWrite(labels.coordinates);
    toast.success(t('mapContextMenu.coordinatesCopied'));
  }, [labels, t]);

  const handleCenter = useCallback(() => {
    if (!point) return;
    trackEvent('context_menu_used', { action: 'center_map' });
    mapRef.current?.easeTo({ center: [point.longitude, point.latitude] });
  }, [mapRef, point]);

  const handleStartHere = useCallback(() => {
    if (!point) return;
    trackEvent('context_menu_used', { action: 'start_here' });
    onStartHere(point.latitude, point.longitude);
  }, [onStartHere, point]);

  const handleMeasure = useCallback(() => {
    if (!point) return;
    trackEvent('context_menu_used', { action: 'measure' });
    useMeasureStore
      .getState()
      .start({ latitude: point.latitude, longitude: point.longitude }, point.snap);
  }, [point]);

  const handleClearMeasurement = useCallback(() => {
    trackEvent('context_menu_used', { action: 'clear_measurement' });
    useMeasureStore.getState().clear();
  }, []);

  const measurePointCount = useMeasureStore((s) => s.line?.points.length ?? 0);
  const handleRemovePoint = useCallback(() => {
    if (point?.measureVertexIndex != null)
      useMeasureStore.getState().removePoint(point.measureVertexIndex);
  }, [point]);

  if (!point || !labels) return null;

  return (
    <DropdownMenu open onOpenChange={(open) => !open && setContextMenuPoint(null)}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0"
          style={{ left: point.x, top: point.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0}>
        <DropdownMenuLabel className="font-mono text-xs font-normal">
          <div className="text-foreground">{labels.coordinates}</div>
          {labels.elevation && (
            <div className="text-muted-foreground">
              {t('mapContextMenu.elevation', { value: labels.elevation })}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleStartHere}>
          <MapPin />
          {t('mapContextMenu.startHere')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleCopy}>
          <Copy />
          {t('mapContextMenu.copyCoordinates')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleMeasure}>
          <Ruler />
          {t('mapContextMenu.measureFromHere')}
        </DropdownMenuItem>
        {point.measureVertexIndex !== null && measurePointCount > 2 && (
          <DropdownMenuItem onSelect={handleRemovePoint}>
            <Trash2 />
            {t('mapContextMenu.removePoint')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={measurePointCount === 0} onSelect={handleClearMeasurement}>
          <Trash2 />
          {t('mapContextMenu.clearMeasurement')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleCenter}>
          <Crosshair />
          {t('mapContextMenu.centerHere')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
