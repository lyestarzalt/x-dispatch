import { useTranslation } from 'react-i18next';
import { ExternalLink, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FaaChartGroup } from '@/lib/parsers/nav/faaChartIndex';
import { cn } from '@/lib/utils/helpers';
import { openExternalLink } from '@/lib/utils/openExternal';
import type { FaaChartLink } from '@/lib/xplaneServices/dataService/navdata/faaChartIndexLoader';
import { trackEvent } from '@/queries';
import { useChartOverlayStore } from '@/stores/chartOverlayStore';

export function ChartControls({
  chart,
  icao,
  group,
  showName = false,
}: {
  chart: FaaChartLink;
  icao: string;
  group: FaaChartGroup;
  showName?: boolean;
}) {
  const { t } = useTranslation();
  const overlayUrl = useChartOverlayStore((s) => s.chart?.url ?? null);
  const toggleOverlay = useChartOverlayStore((s) => s.toggle);
  const overlayActive = overlayUrl === chart.url;
  const overlayLabel = t(
    overlayActive ? 'airportInfo.charts.hideFromMap' : 'airportInfo.charts.showOnMap'
  );
  const openPdf = () => {
    trackEvent('faa_chart_opened', { action: 'pdf', group, airport: icao });
    openExternalLink(chart.url);
  };
  const toggleOnMap = () => {
    if (overlayUrl !== chart.url) {
      trackEvent('faa_chart_opened', { action: 'map', group, airport: icao });
    }
    toggleOverlay({ url: chart.url, name: chart.name, icao });
  };

  return (
    <>
      <Button
        variant="ghost"
        size={showName ? 'sm' : 'icon-sm'}
        onClick={openPdf}
        aria-label={`PDF · ${chart.name}`}
        title={chart.name}
        className={
          showName
            ? 'hover:bg-secondary h-7 min-w-0 flex-1 justify-between gap-2 pr-2 pl-5 text-xs font-normal'
            : 'shrink-0'
        }
      >
        {showName && <span className="min-w-0 truncate">{chart.name}</span>}
        <ExternalLink className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      </Button>
      <div className="flex w-7 shrink-0 justify-center">
        {chart.overlay && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleOnMap}
            aria-pressed={overlayActive}
            aria-label={overlayLabel}
            tooltip={overlayLabel}
            className={cn(
              'shrink-0',
              overlayActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </>
  );
}
