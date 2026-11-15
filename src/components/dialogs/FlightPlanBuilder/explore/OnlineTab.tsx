import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { NetworkPicker } from '@/components/layout/NetworkPicker';
import { Badge } from '@/components/ui/badge';
import { useUnits } from '@/hooks/useUnits';
import { greatCircleNm } from '@/lib/flightplan/builder/geometry';
import { trafficCountsByAirport } from '@/lib/networkTraffic/stations';
import type { NauticalMiles } from '@/lib/utils/geomath';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useNetworkTraffic } from '@/queries/useNetworkTraffic';
import { useMapStore } from '@/stores/mapStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { GateSizeTag } from './GateSizeTag';

interface OnlineTabProps {
  airports: Airport[];
  /** A staffed airport was picked: it becomes the plan's arrival. */
  onPick: (airport: Airport) => void;
}

/** Airports with a controller online on the chosen network, nearest the departure first. */
export function OnlineTab({ airports, onPick }: OnlineTabProps) {
  const { t } = useTranslation();
  const units = useUnits();
  const { network, pilots } = useNetworkTraffic();
  const staffing = useMapStore((s) => s.atcStaffing);
  const departure = usePlanBuilderStore((s) => s.departure);

  const traffic = useMemo(() => trafficCountsByAirport(pilots), [pilots]);
  const byIcao = useMemo(() => new Map(airports.map((a) => [a.icao, a])), [airports]);
  const rows = useMemo(() => {
    const from = departure
      ? { latitude: departure.latitude, longitude: departure.longitude }
      : null;
    const list = Object.values(staffing).flatMap((entry) => {
      const airport = byIcao.get(entry.icao);
      if (!airport || entry.roles.length === 0) return [];
      const distanceNm = from
        ? greatCircleNm(from, { latitude: airport.lat, longitude: airport.lon })
        : null;
      const counts = traffic.get(airport.icao.toUpperCase());
      return [{ airport, roles: entry.roles, distanceNm, counts }];
    });
    return list.sort((a, b) =>
      a.distanceNm !== null && b.distanceNm !== null
        ? a.distanceNm - b.distanceNm
        : a.airport.icao.localeCompare(b.airport.icao)
    );
  }, [staffing, byIcao, departure, traffic]);

  const networkPicker = <NetworkPicker className="mb-2" />;

  if (network === null) {
    return (
      <div>
        {networkPicker}
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t('explore.online.networkOff')}
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        {networkPicker}
        <p className="text-muted-foreground py-6 text-center text-xs">{t('explore.online.none')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {networkPicker}
      {rows.slice(0, 60).map(({ airport, roles, distanceNm, counts }) => (
        <button
          key={airport.icao}
          onClick={() => onPick(airport)}
          className="group hover:bg-muted/50 flex w-full min-w-0 items-start gap-3 overflow-hidden rounded px-2 py-2 text-left transition-colors"
        >
          <span className="flex shrink-0 flex-col items-start gap-0.5">
            <span className="text-info mt-px font-mono text-sm font-semibold">{airport.icao}</span>
            <GateSizeTag code={airport.maxStandCode} />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground truncate text-sm font-medium">{airport.name}</span>
              {distanceNm !== null && (
                <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                  {units.distance(distanceNm as NauticalMiles)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {roles.map((role) => (
                <Badge key={role} variant="secondary" className="text-2xs px-1 py-0 font-mono">
                  {role}
                </Badge>
              ))}
              {counts && (
                <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
                  <span
                    className="text-cat-emerald flex items-center gap-1"
                    aria-label={`${counts.departures} ${t('airportInfo.conditions.departures')}`}
                  >
                    <PlaneTakeoff className="h-3 w-3" />
                    <span className="font-mono tabular-nums">{counts.departures}</span>
                  </span>
                  <span
                    className="text-cat-amber flex items-center gap-1"
                    aria-label={`${counts.arrivals} ${t('airportInfo.conditions.arrivals')}`}
                  >
                    <PlaneLanding className="h-3 w-3" />
                    <span className="font-mono tabular-nums">{counts.arrivals}</span>
                  </span>
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
