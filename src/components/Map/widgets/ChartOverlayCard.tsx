import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/helpers';
import { useRetryFaaChartPdf } from '@/queries';
import { CHART_OVERLAY_MIN_OPACITY, useChartOverlayStore } from '@/stores/chartOverlayStore';
import { useDragPosition } from '../hooks/useDragPosition';

/**
 * The chart laid over the map: its title, how see-through it is, and a way to take it off.
 * Drag it anywhere on the map; a double-click puts it back.
 */
export default function ChartOverlayCard() {
  const { t } = useTranslation();
  const chart = useChartOverlayStore((s) => s.chart);
  const status = useChartOverlayStore((s) => s.status);
  const error = useChartOverlayStore((s) => s.error);
  const opacity = useChartOverlayStore((s) => s.opacity);
  const setOpacity = useChartOverlayStore((s) => s.setOpacity);
  const hide = useChartOverlayStore((s) => s.hide);
  const retry = useChartOverlayStore((s) => s.retry);
  const refetchPdf = useRetryFaaChartPdf();
  const cardPosition = useChartOverlayStore((s) => s.cardPosition);
  const setCardPosition = useChartOverlayStore((s) => s.setCardPosition);
  const { stripRef, position, handleMouseDown, handleDoubleClick } = useDragPosition(
    cardPosition,
    setCardPosition
  );
  if (!chart) return null;

  const percent = Math.round(opacity * 100);
  return (
    <div
      ref={stripRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'z-10 w-64 cursor-grab select-none active:cursor-grabbing',
        // By default beside the compass, clear of the flight strip and the profile strip.
        position ? 'fixed' : 'absolute bottom-[var(--map-replay-bottom,6rem)] left-32'
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
      role="region"
      aria-label={t('chartOverlay.title')}
    >
      <div className="border-border/50 bg-card/90 space-y-2 rounded-lg border px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate text-xs">
              {t('chartOverlay.heading', { icao: chart.icao })}
            </p>
            <p className="text-foreground truncate text-sm" title={chart.name}>
              {chart.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={hide}
            className="text-muted-foreground hover:text-foreground shrink-0"
            tooltip={t('chartOverlay.hide')}
            aria-label={t('chartOverlay.hide')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {status === 'loading' && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="h-3.5 w-3.5" />
            <span className="min-w-0 truncate">{t('chartOverlay.loading')}</span>
          </div>
        )}
        {status === 'error' && error && (
          <div className="flex items-center gap-2">
            <p className="text-destructive min-w-0 flex-1 text-xs">
              {t(`chartOverlay.errors.${error}`)}
            </p>
            {error === 'network' && (
              <Button
                variant="outline"
                size="xs"
                className="shrink-0"
                onClick={() => {
                  retry();
                  void refetchPdf(chart.url);
                }}
              >
                {t('common.retry')}
              </Button>
            )}
          </div>
        )}
        {status === 'shown' && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground min-w-0 shrink truncate text-xs">
              {t('chartOverlay.opacity')}
            </span>
            <Slider
              onMouseDown={(event) => event.stopPropagation()}
              className="min-w-0 flex-1 cursor-pointer"
              min={CHART_OVERLAY_MIN_OPACITY * 100}
              max={100}
              step={1}
              value={[percent]}
              onValueChange={([value]) => value !== undefined && setOpacity(value / 100)}
              aria-label={t('chartOverlay.opacity')}
            />
            <span className="text-foreground w-9 shrink-0 text-right font-mono text-xs">
              {t('chartOverlay.opacityValue', { percent })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
