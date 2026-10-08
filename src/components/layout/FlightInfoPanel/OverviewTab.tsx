import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { formatFlightTime, formatFuel, formatWeight } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import type { SimBriefOFP } from '@/types/simbrief';
import { StatBox } from './StatBox';

// Overview Tab
export function OverviewTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox
          label={t('simbriefDialog.stats.ete')}
          value={formatFlightTime(data.times.est_time_enroute)}
        />
        <StatBox label={t('simbriefDialog.stats.fl')} value={data.general.initial_altitude} />
        <StatBox label={t('simbriefDialog.stats.ci')} value={data.general.costindex} />
        <StatBox label={t('simbriefDialog.stats.airac')} value={data.general.airac} />
      </div>

      {/* Wind */}
      <div className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2">
        <span className="text-muted-foreground text-sm">{t('flightInfoPanel.avgWind')}</span>
        <span className="font-mono text-sm font-medium">
          {t('simbriefDialog.performance.windDirSpeed', {
            dir: data.general.avg_wind_dir,
            speed: data.general.avg_wind_spd,
          })}
        </span>
      </div>

      {/* Fuel Summary */}
      <div className="bg-muted/40 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flightInfoPanel.blockFuel')}</span>
          <span className="font-mono font-medium">{formatFuel(data.fuel.plan_ramp, apiUnit)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flightInfoPanel.landing')}</span>
          <span className="text-success font-mono font-medium">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </span>
        </div>
      </div>

      {/* Weights Summary */}
      <div className="bg-muted/40 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('simbriefDialog.weights.tow')}</span>
          <span className="font-mono font-medium">
            {formatWeight(data.weights.est_tow, apiUnit)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flightInfoPanel.paxCargo')}</span>
          <span className="font-mono font-medium">
            {data.weights.pax_count} / {formatWeight(data.weights.cargo, apiUnit)}
          </span>
        </div>
      </div>

      {/* Alternate */}
      {data.alternate && (
        <div className="bg-warning/10 flex items-center justify-between rounded-lg px-3 py-2">
          <span className="text-warning/70 text-sm">{t('flightInfoPanel.alternate')}</span>
          <Button
            variant="link"
            onClick={() => useAppStore.getState().requestSelectAirport(data.alternate!.icao_code)}
            className="h-auto p-0 font-mono text-sm font-medium"
            aria-label={t('simbriefDialog.header.goToAirportLayoutAria', {
              icao: data.alternate.icao_code,
            })}
          >
            {data.alternate.icao_code}
          </Button>
        </div>
      )}

      {/* PDF Link */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground text-2xs h-7 w-full justify-center"
        onClick={() => window.appAPI.openExternal(data.files.pdf.link)}
      >
        {t('simbriefDialog.viewFullOfp')}
      </Button>
    </div>
  );
}
