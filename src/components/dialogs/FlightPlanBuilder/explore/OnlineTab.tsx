import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { useUnits } from '@/hooks/useUnits';
import { greatCircleNm } from '@/lib/flightplan/builder/geometry';
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
  const { network } = useNetworkTraffic();
  const staffing = useMapStore((s) => s.atcStaffing);
  const setVatsimEnabled = useMapStore((s) => s.setVatsimEnabled);
  const setIvaoEnabled = useMapStore((s) => s.setIvaoEnabled);
  const departure = usePlanBuilderStore((s) => s.departure);

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
      return [{ airport, roles: entry.roles, distanceNm }];
    });
    return list.sort((a, b) =>
      a.distanceNm !== null && b.distanceNm !== null
        ? a.distanceNm - b.distanceNm
        : a.airport.icao.localeCompare(b.airport.icao)
    );
  }, [staffing, byIcao, departure]);

  // The same two switches as the Layers panel, so a pilot who opens this list
  // with no network on does not have to leave it to pick one.
  const networkPicker = (
    <div className="mb-2 flex items-center gap-2">
      <Toggle
        variant="subtle"
        size="xs"
        pressed={network === 'vatsim'}
        onPressedChange={(on) => setVatsimEnabled(on)}
        aria-label={t('toolbar.vatsim')}
        className="data-[state=off]:bg-secondary/40 data-[state=off]:text-muted-foreground flex-1 justify-center data-[state=on]:ring-0"
      >
        <Radar className="shrink-0" />
        {t('toolbar.vatsim')}
      </Toggle>
      <Toggle
        variant="subtle"
        size="xs"
        pressed={network === 'ivao'}
        onPressedChange={(on) => setIvaoEnabled(on)}
        aria-label="IVAO"
        className="data-[state=off]:bg-secondary/40 data-[state=off]:text-muted-foreground flex-1 justify-center data-[state=on]:ring-0"
      >
        <Radar className="shrink-0" />
        IVAO
      </Toggle>
    </div>
  );

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
      {rows.slice(0, 60).map(({ airport, roles, distanceNm }) => (
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
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
