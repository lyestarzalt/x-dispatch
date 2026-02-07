import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Info, Plane, Radio, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  VatsimData,
  getATISForAirport,
  getControllersForAirport,
  getPrefilesForAirport,
  getTrafficCountsForAirport,
  parseATISRunways,
} from '@/queries/useVatsimQuery';

interface VatsimSectionProps {
  icao: string;
  vatsimData: VatsimData | undefined;
  vatsimMetar: string | null;
  lastUpdate: Date | undefined;
}

function formatTimeSince(date: Date | undefined): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export default function VatsimSection({
  icao,
  vatsimData,
  vatsimMetar,
  lastUpdate,
}: VatsimSectionProps) {
  const { t } = useTranslation();

  const controllers = useMemo(() => getControllersForAirport(vatsimData, icao), [vatsimData, icao]);

  const atis = useMemo(() => getATISForAirport(vatsimData, icao), [vatsimData, icao]);

  const prefiles = useMemo(() => getPrefilesForAirport(vatsimData, icao), [vatsimData, icao]);

  const trafficCounts = useMemo(
    () => getTrafficCountsForAirport(vatsimData, icao),
    [vatsimData, icao]
  );

  const handleCopyFrequency = (frequency: string) => {
    navigator.clipboard.writeText(frequency);
  };

  const primaryAtis = atis[0];
  const runways = primaryAtis ? parseATISRunways(primaryAtis) : [];

  const hasNoData = !vatsimMetar && controllers.length === 0 && atis.length === 0;

  if (!vatsimData) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">{t('sidebar.vatsim.notEnabled')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with last update */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-wider">VATSIM Live</span>
        {lastUpdate && <span>{formatTimeSince(lastUpdate)}</span>}
      </div>

      {/* METAR */}
      {vatsimMetar && (
        <div>
          <h4 className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">METAR</h4>
          <div className="rounded bg-muted/50 p-2">
            <p className="font-mono text-xs leading-relaxed text-foreground">{vatsimMetar}</p>
          </div>
        </div>
      )}

      {/* ATIS */}
      {primaryAtis && (
        <div>
          <h4 className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">ATIS</h4>
          <div className="rounded bg-muted/50 p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-sm">
                  {primaryAtis.atis_code || '?'}
                </Badge>
                {runways.length > 0 && (
                  <span className="text-xs text-muted-foreground">RWY {runways.join(', ')}</span>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Info className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="whitespace-pre-wrap font-mono text-xs">
                      {primaryAtis.text_atis?.join('\n') || 'No ATIS text'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      )}

      {/* ATC Online */}
      {controllers.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Radio className="h-3 w-3 text-success" />
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">ATC Online</h4>
          </div>
          <div className="space-y-1">
            {controllers.map((controller) => (
              <div
                key={controller.callsign}
                className="group flex items-center justify-between rounded bg-muted/50 p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-success">{controller.callsign}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {controller.frequency}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyFrequency(controller.frequency)}
                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traffic */}
      {(trafficCounts.departures > 0 || trafficCounts.arrivals > 0 || prefiles.length > 0) && (
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Plane className="h-3 w-3 text-info" />
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Traffic</h4>
          </div>
          <div className="flex items-center gap-4 rounded bg-muted/50 p-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-success">↗</span>
              <span className="font-mono text-sm">{trafficCounts.departures}</span>
              <span className="text-xs text-muted-foreground">dep</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-warning">↘</span>
              <span className="font-mono text-sm">{trafficCounts.arrivals}</span>
              <span className="text-xs text-muted-foreground">arr</span>
            </div>
            {prefiles.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-sm">{prefiles.length}</span>
                <span className="text-xs text-muted-foreground">prefiled</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No data message */}
      {hasNoData && (
        <div className="py-2 text-center">
          <p className="text-xs text-muted-foreground">No VATSIM activity at {icao}</p>
        </div>
      )}
    </div>
  );
}
