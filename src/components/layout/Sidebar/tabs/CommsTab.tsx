import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Info, Plane, Radio, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatFrequency } from '@/lib/utils/format';
import { useATCControllers, useVatsimQuery } from '@/queries';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import {
  getATISForAirport,
  getControllersForAirport,
  getPrefilesForAirport,
  getTrafficCountsForAirport,
  parseATISRunways,
} from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import type { Frequency } from '@/types/apt';
import { FrequencyType } from '@/types/apt';

const FREQ_ORDER: FrequencyType[] = [
  FrequencyType.AWOS,
  FrequencyType.TOWER,
  FrequencyType.GROUND,
  FrequencyType.DELIVERY,
  FrequencyType.APPROACH,
  FrequencyType.CENTER,
  FrequencyType.CTAF,
  FrequencyType.UNICOM,
];

const FREQ_LABELS: Record<FrequencyType, string> = {
  [FrequencyType.AWOS]: 'ATIS/AWOS',
  [FrequencyType.TOWER]: 'Tower',
  [FrequencyType.GROUND]: 'Ground',
  [FrequencyType.DELIVERY]: 'Delivery',
  [FrequencyType.APPROACH]: 'Approach',
  [FrequencyType.CENTER]: 'Center',
  [FrequencyType.CTAF]: 'CTAF',
  [FrequencyType.UNICOM]: 'UNICOM',
};

export default function CommsTab() {
  const { t } = useTranslation();

  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);

  const frequencies = useMemo(() => airport?.frequencies ?? [], [airport?.frequencies]);
  const { data: atcControllers = [] } = useATCControllers(icao);
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);

  const vatsimMetar = vatsimMetarData?.raw ?? null;
  const vatsimControllers = useMemo(
    () => getControllersForAirport(vatsimData, icao ?? ''),
    [vatsimData, icao]
  );
  const atis = useMemo(() => getATISForAirport(vatsimData, icao ?? ''), [vatsimData, icao]);
  const prefiles = useMemo(() => getPrefilesForAirport(vatsimData, icao ?? ''), [vatsimData, icao]);
  const trafficCounts = useMemo(
    () => getTrafficCountsForAirport(vatsimData, icao ?? ''),
    [vatsimData, icao]
  );

  const groupedFrequencies = useMemo(
    () =>
      frequencies.reduce<Partial<Record<FrequencyType, Frequency[]>>>((groups, freq) => {
        const existing = groups[freq.type] ?? [];
        return { ...groups, [freq.type]: [...existing, freq] };
      }, {}),
    [frequencies]
  );

  const handleCopy = (value: string | number) => {
    const text = typeof value === 'number' ? formatFrequency(value) : value;
    navigator.clipboard.writeText(text);
  };

  const primaryAtis = atis[0];
  const runways = primaryAtis ? parseATISRunways(primaryAtis) : [];
  const hasVatsimActivity =
    vatsimControllers.length > 0 ||
    atis.length > 0 ||
    trafficCounts.departures > 0 ||
    trafficCounts.arrivals > 0;

  return (
    <div className="space-y-6">
      {/* VATSIM Section - if enabled and has activity */}
      {vatsimEnabled && hasVatsimActivity && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              VATSIM Live
            </span>
          </div>

          {/* ATIS */}
          {primaryAtis && (
            <div className="mb-3 rounded-lg bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-sm">
                    ATIS {primaryAtis.atis_code || '?'}
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
          )}

          {/* VATSIM ATC */}
          {vatsimControllers.length > 0 && (
            <div className="mb-3 space-y-1">
              {vatsimControllers.map((controller) => (
                <div
                  key={controller.callsign}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <Radio className="h-3 w-3 text-emerald-400" />
                    <span className="text-sm text-foreground">{controller.callsign}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(controller.frequency)}
                    className="flex items-center gap-1 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {controller.frequency}
                    <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Traffic */}
          {(trafficCounts.departures > 0 || trafficCounts.arrivals > 0 || prefiles.length > 0) && (
            <div className="flex items-center gap-4 rounded-lg bg-muted/30 px-3 py-2">
              <Plane className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">↗</span>
                <span className="font-mono text-sm">{trafficCounts.departures}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-amber-400">↘</span>
                <span className="font-mono text-sm">{trafficCounts.arrivals}</span>
              </div>
              {prefiles.length > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span className="font-mono text-sm">{prefiles.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* METAR */}
      {vatsimMetar && (
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            METAR
          </h4>
          <p className="font-mono text-xs leading-relaxed text-foreground/80">{vatsimMetar}</p>
        </div>
      )}

      {/* Airport Frequencies */}
      {frequencies.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Frequencies
          </h4>
          <div className="space-y-3">
            {FREQ_ORDER.map((type) => {
              const freqs = groupedFrequencies[type];
              if (!freqs || freqs.length === 0) return null;

              return (
                <div key={type}>
                  <span className="mb-1 block text-xs text-muted-foreground/60">
                    {FREQ_LABELS[type]}
                  </span>
                  <div className="space-y-1">
                    {freqs.map((freq, i) => (
                      <button
                        key={i}
                        onClick={() => handleCopy(freq.frequency)}
                        className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/30"
                      >
                        <span className="max-w-[140px] truncate text-sm text-foreground/70">
                          {freq.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm text-foreground">
                            {formatFrequency(freq.frequency)}
                          </span>
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigraph ATC Controllers */}
      {atcControllers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ATC Controllers
            </h4>
            <Badge variant="outline" className="px-1.5 py-0 text-xs">
              Navigraph
            </Badge>
          </div>
          <div className="space-y-2">
            {atcControllers.map((controller, i) => (
              <div key={i} className="rounded-lg bg-muted/20 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{controller.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {controller.facilityId}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {controller.frequencies.map((freq, fi) => (
                    <button
                      key={fi}
                      onClick={() => handleCopy(freq)}
                      className="rounded bg-muted/50 px-2 py-1 font-mono text-xs text-foreground/80 transition-colors hover:bg-muted"
                    >
                      {formatFrequency(freq)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data */}
      {frequencies.length === 0 &&
        atcControllers.length === 0 &&
        !vatsimMetar &&
        !hasVatsimActivity && (
          <p className="py-12 text-center text-sm text-muted-foreground/60">
            {t('sidebar.noFrequencies')}
          </p>
        )}
    </div>
  );
}
