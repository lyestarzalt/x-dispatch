import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import { SimbriefLogo } from '@/components/ui/SimbriefLogo';
import { Button } from '@/components/ui/button';
import { useOfpUnits } from '@/hooks/useOfpUnits';
import { primaryAlternate } from '@/lib/simbrief/ofp';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { formatFlightTime } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';

/**
 * The imported SimBrief plan, in the corner of the map: the route, its alternate, four
 * figures, and a button to the full briefing. Everything else lives in the briefing dialog,
 * one click away, so this card never has to repeat it.
 */
function FlightInfoPanel() {
  const { t } = useTranslation();
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);
  const clearFlightPlan = useFlightPlanStore((s) => s.clearFlightPlan);
  const openSimbriefDialog = useFlightPlanStore((s) => s.openSimbriefDialog);
  const units = useOfpUnits(simbriefData?.params.units ?? 'lbs');

  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!simbriefData) {
    return null;
  }

  const { origin, destination, general, aircraft, atc, times, fuel, weights } = simbriefData;
  const alternate = primaryAlternate(simbriefData);
  const flightNumber = general.icao_airline
    ? `${general.icao_airline}${general.flight_number}`
    : atc.callsign;
  const cruise = Math.round((parseInt(general.initial_altitude, 10) || 0) / 100);
  const goToAirport = (icao: string) => useAppStore.getState().requestSelectAirport(icao);

  const figures: { label: string; value: string }[] = [
    { label: t('simbriefDialog.stats.ete'), value: formatFlightTime(times.est_time_enroute) },
    {
      label: t('simbriefDialog.stats.cruise'),
      value: t('simbriefDialog.performance.flightLevel', { value: cruise }),
    },
    { label: t('simbriefDialog.stats.blockFuel'), value: units.ofpWeight(fuel.plan_ramp) },
    { label: t('simbriefDialog.stats.takeoffWeight'), value: units.ofpWeight(weights.est_tow) },
  ];

  return (
    <div
      className={cn(
        'absolute left-4 z-30 transition-all duration-300 ease-out',
        isCollapsed ? 'top-28 w-12' : 'top-28 w-80'
      )}
    >
      <div
        className={cn(
          'border-border/40 bg-card/95 relative flex flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm transition-all duration-300',
          isCollapsed && 'h-72'
        )}
      >
        {/* Collapsed rail */}
        <div
          className={cn(
            'bg-card/95 absolute inset-0 z-20 flex flex-col items-center py-5 transition-opacity duration-200',
            isCollapsed ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="mb-4 h-8 w-8"
            onClick={() => setIsCollapsed(false)}
            aria-label={t('flightInfoPanel.expand')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* What a pilot wants at a glance with the card folded: who, where, how high */}
          <div className="flex min-h-0 flex-1 flex-col items-center gap-3">
            <span
              className="text-foreground font-mono text-sm font-bold tracking-wider"
              style={{ writingMode: 'vertical-rl' }}
            >
              {flightNumber}
            </span>
            <span
              className="text-muted-foreground flex items-center gap-1 font-mono text-xs"
              style={{ writingMode: 'vertical-rl' }}
            >
              <span className="text-foreground/80">{origin.icao_code}</span>
              <ArrowRight className="h-3 w-3 rotate-90" />
              <span className="text-foreground/80">{destination.icao_code}</span>
            </span>
            <span
              className="text-muted-foreground font-mono text-xs"
              style={{ writingMode: 'vertical-rl' }}
            >
              {t('simbriefDialog.performance.flightLevel', { value: cruise })}
            </span>
          </div>
        </div>

        {/* Title row: who the plan is from, and the controls */}
        <div
          className={cn(
            'border-border/30 flex items-center justify-between border-b px-3 py-2',
            isCollapsed && 'opacity-0'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <SimbriefLogo size="sm" className="opacity-90" />
            <span className="truncate font-mono text-sm font-semibold">{flightNumber}</span>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/40 hover:text-foreground"
              onClick={() => setIsCollapsed(true)}
              aria-label={t('flightInfoPanel.collapse')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={clearFlightPlan}
              aria-label={t('flightInfoPanel.clear')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className={cn('space-y-3 px-4 py-3', isCollapsed && 'opacity-0')}>
          {/* The route */}
          <div>
            <div className="flex items-center gap-2">
              <IcaoLink icao={origin.icao_code} onClick={() => goToAirport(origin.icao_code)} />
              <ArrowRight className="text-muted-foreground h-4 w-4" />
              <IcaoLink
                icao={destination.icao_code}
                onClick={() => goToAirport(destination.icao_code)}
              />
            </div>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              <span className="font-mono">{origin.plan_rwy}</span>
              <ArrowRight className="mx-1.5 inline h-3 w-3 align-[-2px]" />
              <span className="font-mono">{destination.plan_rwy}</span>
              <span className="mx-1.5 opacity-50">|</span>
              <span className="font-mono">
                {units.distance(parseFloat(general.route_distance) as NauticalMiles)}
              </span>
              <span className="mx-1.5 opacity-50">|</span>
              <span>{aircraft.icao_code}</span>
            </p>
            {alternate && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {t('simbriefDialog.header.alternate')}{' '}
                <Button
                  variant="link"
                  onClick={() => goToAirport(alternate.icao_code)}
                  className="text-foreground/80 h-auto p-0 font-mono text-xs font-semibold"
                  aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
                    icao: alternate.icao_code,
                  })}
                >
                  {alternate.icao_code}
                </Button>
              </p>
            )}
          </div>

          {/* Four figures */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {figures.map((figure) => (
              <div key={figure.label} className="min-w-0">
                <dt className="text-muted-foreground truncate text-xs">{figure.label}</dt>
                <dd className="xp-value truncate font-medium">{figure.value}</dd>
              </div>
            ))}
          </dl>

          <Button
            variant="secondary"
            size="sm"
            className="w-full gap-2"
            onClick={() => openSimbriefDialog()}
          >
            <FileText className="h-4 w-4" />
            {t('simbrief.openFullBriefing')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IcaoLink({ icao, onClick }: { icao: string; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="link"
      onClick={onClick}
      className="h-auto p-0 font-mono text-xl font-bold tracking-tight"
      aria-label={t('simbriefDialog.header.goToAirportLayoutAria', { icao })}
    >
      {icao}
    </Button>
  );
}

export default memo(FlightInfoPanel);
