import { useTranslation } from 'react-i18next';
import {
  Gauge,
  Navigation,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Timer,
  Wind,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatDistance, formatFlightTime } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import type { SimBriefOFP } from '@/types/simbrief';
import { StatItem } from './StatItem';

// Flight Header Component - Airline dispatch style
export function FlightHeader({
  data,
  onAirportClick,
}: {
  data: SimBriefOFP;
  /** Called after the user clicks an ICAO so the dialog can close itself. */
  onAirportClick: () => void;
}) {
  const { t } = useTranslation();
  const flightNumber = data.general.icao_airline
    ? `${data.general.icao_airline}${data.general.flight_number}`
    : data.atc.callsign;

  const handleIcaoClick = (icao: string) => {
    useAppStore.getState().requestSelectAirport(icao);
    onAirportClick();
  };

  return (
    <div className="bg-card px-6 py-5">
      <div className="flex items-start justify-between">
        {/* Route Display */}
        <div className="flex items-center gap-6">
          {/* Origin */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => handleIcaoClick(data.origin.icao_code)}
              className="h-auto p-0 font-mono text-3xl font-bold tracking-tight"
              aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                icao: data.origin.icao_code,
              })}
            >
              {data.origin.icao_code}
            </Button>
            <p className="text-muted-foreground mt-0.5 text-sm">{data.origin.name}</p>
            <div className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-sm">
              <PlaneTakeoff className="h-3 w-3" />
              <span>{t('simbriefDialog.header.runway', { rwy: data.origin.plan_rwy })}</span>
            </div>
          </div>

          {/* Flight Line */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="via-border to-border h-px w-12 bg-gradient-to-r from-transparent" />
              <Plane className="text-primary h-5 w-5 rotate-90" />
              <div className="from-border via-border h-px w-12 bg-gradient-to-r to-transparent" />
            </div>
            <span className="text-muted-foreground text-2xs font-mono">
              {formatDistance(data.general.air_distance)}
            </span>
          </div>

          {/* Destination */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => handleIcaoClick(data.destination.icao_code)}
              className="h-auto p-0 font-mono text-3xl font-bold tracking-tight"
              aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                icao: data.destination.icao_code,
              })}
            >
              {data.destination.icao_code}
            </Button>
            <p className="text-muted-foreground mt-0.5 text-sm">{data.destination.name}</p>
            <div className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-sm">
              <PlaneLanding className="h-3 w-3" />
              <span>{t('simbriefDialog.header.runway', { rwy: data.destination.plan_rwy })}</span>
            </div>
          </div>
        </div>

        {/* Flight Info */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <Badge className="bg-primary/20 text-primary hover:bg-primary/20 font-mono text-sm font-bold">
              {flightNumber}
            </Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="text-muted-foreground flex items-center justify-end gap-2">
              <span>{data.aircraft.icao_code}</span>
              <span className="text-border">|</span>
              <span className="font-mono">
                {data.aircraft.reg || t('simbriefDialog.notAvailable')}
              </span>
            </div>
            <p className="text-muted-foreground">{data.aircraft.name}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-card/50 mt-5 flex items-center justify-between rounded-lg px-4 py-3">
        <StatItem
          icon={Timer}
          label={t('simbriefDialog.stats.ete')}
          value={formatFlightTime(data.times.est_time_enroute)}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem
          icon={Gauge}
          label={t('simbriefDialog.stats.fl')}
          value={data.general.initial_altitude}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem
          icon={Wind}
          label={t('simbriefDialog.stats.avgWind')}
          value={`${data.general.avg_wind_dir}°/${data.general.avg_wind_spd}kt`}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem
          icon={Navigation}
          label={t('simbriefDialog.stats.ci')}
          value={data.general.costindex}
        />
        <Separator orientation="vertical" className="bg-border h-8" />
        <StatItem icon={Route} label={t('simbriefDialog.stats.airac')} value={data.params.airac} />
      </div>
    </div>
  );
}
