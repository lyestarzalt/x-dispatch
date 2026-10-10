import { useTranslation } from 'react-i18next';
import { ArrowRight, Route } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOfpUnits } from '@/hooks/useOfpUnits';
import { primaryAlternate } from '@/lib/simbrief/ofp';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { formatFlightTime } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import type { SimBriefOFP } from '@/types/simbrief';

interface DispatchHeaderProps {
  data: SimBriefOFP;
  apiUnit: string;
  /** The plan is already on the map, so the button offers to import it again. */
  imported: boolean;
  onImport: () => void;
  /** Called after the user clicks an ICAO so the dialog can close itself. */
  onAirportClick: () => void;
}

/**
 * The dispatch strip. One big line says where the flight goes; the two small lines under it
 * say how (runways, distance, time, alternate). The flight and aircraft sit to the right, and
 * the Import button ends the line. Four go/no-go figures run along the bottom.
 */
export function DispatchHeader({
  data,
  apiUnit,
  imported,
  onImport,
  onAirportClick,
}: DispatchHeaderProps) {
  const { t } = useTranslation();
  const units = useOfpUnits(apiUnit);
  const { origin, destination, general, aircraft, weights, times, atc } = data;
  const alternate = primaryAlternate(data);
  const flightNumber = general.icao_airline
    ? `${general.icao_airline}${general.flight_number}`
    : atc.callsign;
  const cruise = Math.round((parseInt(general.initial_altitude, 10) || 0) / 100);
  const towPercent = Math.round(
    (parseInt(weights.est_tow, 10) / parseInt(weights.max_tow, 10)) * 100
  );

  const goToAirport = (icao: string) => {
    useAppStore.getState().requestSelectAirport(icao);
    onAirportClick();
  };

  const figures: { label: string; value: string }[] = [
    {
      label: t('simbriefDialog.stats.cruise'),
      value: t('simbriefDialog.performance.flightLevel', { value: cruise }),
    },
    { label: t('simbriefDialog.stats.blockFuel'), value: units.ofpWeight(data.fuel.plan_ramp) },
    {
      label: t('simbriefDialog.stats.takeoffWeight'),
      value: Number.isFinite(towPercent)
        ? `${units.ofpWeight(weights.est_tow)} (${t('simbriefDialog.stats.percentOfMax', { value: towPercent })})`
        : units.ofpWeight(weights.est_tow),
    },
    {
      label: t('simbriefDialog.stats.avgWind'),
      value: `${general.avg_wind_dir}°/${general.avg_wind_spd} ${t('units.kt')}`,
    },
  ];

  return (
    <div className="bg-card border-b px-6 py-4">
      <div className="flex items-start justify-between gap-6">
        {/* The route */}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <IcaoLink icao={origin.icao_code} onClick={() => goToAirport(origin.icao_code)} />
            <ArrowRight className="text-muted-foreground h-6 w-6" />
            <IcaoLink
              icao={destination.icao_code}
              onClick={() => goToAirport(destination.icao_code)}
            />
          </div>
          <p className="text-muted-foreground mt-1 truncate text-sm">
            <span className="text-foreground/80">{airportLine(origin.name, origin.plan_rwy)}</span>
            <ArrowRight className="mx-2 inline h-3.5 w-3.5 align-[-2px]" />
            <span className="text-foreground/80">
              {airportLine(destination.name, destination.plan_rwy)}
            </span>
            <span className="mx-2 opacity-50">|</span>
            <span className="font-mono">
              {units.distance(parseFloat(general.route_distance) as NauticalMiles)}
            </span>
            <span className="mx-2 opacity-50">|</span>
            <span className="font-mono">{formatFlightTime(times.est_time_enroute)}</span>
          </p>
          {alternate && (
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {t('simbriefDialog.header.alternate')}{' '}
              <Button
                variant="link"
                onClick={() => goToAirport(alternate.icao_code)}
                className="text-foreground/80 h-auto p-0 font-mono text-sm font-semibold"
                aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                  icao: alternate.icao_code,
                })}
              >
                {alternate.icao_code}
              </Button>{' '}
              <span className="text-foreground/80">
                {airportLine(alternate.name, alternate.plan_rwy)}
              </span>
            </p>
          )}
        </div>

        {/* The flight, and the action */}
        <div className="flex shrink-0 items-start gap-6">
          <div className="text-right">
            <p className="font-mono text-lg font-semibold">{flightNumber}</p>
            <p className="text-muted-foreground max-w-[14rem] truncate text-sm">
              {aircraft.name}
              {aircraft.reg && <span className="font-mono"> {aircraft.reg}</span>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button size="lg" onClick={onImport} className="gap-2">
              <Route className="h-4 w-4" />
              {imported
                ? t('simbriefDialog.actions.importAgain')
                : t('simbriefDialog.actions.import')}
            </Button>
            {imported && (
              <Badge variant="success" className="text-2xs">
                {t('simbriefDialog.actions.onMap')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-sm">
        {figures.map((figure) => (
          <span key={figure.label} className="whitespace-nowrap">
            {figure.label} <span className="xp-value font-medium">{figure.value}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/** "Heathrow 27R": the airport name in title case with its planned runway. */
function airportLine(name: string, runway: string): string {
  const titled = name
    .toLowerCase()
    .replace(/(^|[\s/-])([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bIntl\b/g, 'Intl');
  return runway ? `${titled} ${runway}` : titled;
}

function IcaoLink({ icao, onClick }: { icao: string; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="link"
      onClick={onClick}
      className="h-auto p-0 font-mono text-3xl font-bold tracking-tight"
      aria-label={t('simbriefDialog.header.goToAirportLayoutAria', { icao })}
    >
      {icao}
    </Button>
  );
}
