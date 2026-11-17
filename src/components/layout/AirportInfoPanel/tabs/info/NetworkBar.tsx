import { useTranslation } from 'react-i18next';
import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { NetworkPicker } from '@/components/layout/NetworkPicker';
import { trafficCountsForAirport } from '@/lib/networkTraffic/stations';
import { useNetworkTraffic } from '@/queries/useNetworkTraffic';

/**
 * The network switches and the online traffic for the airport, so comparing VATSIM and
 * IVAO here needs no trip to Layers. Sits above the Info tab's scroll area, where
 * scrolling the card never takes it away.
 */
export function NetworkBar({ icao }: { icao: string | null }) {
  const { t } = useTranslation();
  const { network, pilots } = useNetworkTraffic();
  const traffic = network !== null && icao ? trafficCountsForAirport(pilots, icao) : null;
  const showTraffic = traffic && (traffic.departures > 0 || traffic.arrivals > 0);
  return (
    <div className="flex items-center gap-3">
      <NetworkPicker className="flex-1" />
      {showTraffic && (
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <span
            className="text-cat-emerald flex items-center gap-1"
            aria-label={`${traffic.departures} ${t('airportInfo.conditions.departures')}`}
          >
            <PlaneTakeoff className="h-3 w-3" />
            <span className="font-mono tabular-nums">{traffic.departures}</span>
          </span>
          <span
            className="text-cat-amber flex items-center gap-1"
            aria-label={`${traffic.arrivals} ${t('airportInfo.conditions.arrivals')}`}
          >
            <PlaneLanding className="h-3 w-3" />
            <span className="font-mono tabular-nums">{traffic.arrivals}</span>
          </span>
        </span>
      )}
    </div>
  );
}
