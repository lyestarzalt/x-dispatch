import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useOfpUnits } from '@/hooks/useOfpUnits';
import { cn } from '@/lib/utils/helpers';
import type { SimBriefOFP } from '@/types/simbrief';

/** Fuel on the left, weights on the right: the two halves of the same loading decision. */
export function FuelWeightsTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FuelColumn data={data} apiUnit={apiUnit} />
      <WeightsColumn data={data} apiUnit={apiUnit} />
    </div>
  );
}

function FuelColumn({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const units = useOfpUnits(apiUnit);
  const totalFuel = parseInt(data.fuel.plan_ramp, 10);
  const fuelItems = [
    {
      id: 'taxi',
      label: t('simbriefDialog.fuelTab.taxi'),
      value: data.fuel.taxi,
      color: 'bg-primary/40',
    },
    {
      id: 'trip',
      label: t('simbriefDialog.fuelTab.trip'),
      value: data.fuel.enroute_burn,
      color: 'bg-primary',
    },
    {
      id: 'contingency',
      label: t('simbriefDialog.fuelTab.contingency'),
      value: data.fuel.contingency,
      color: 'bg-primary/40',
    },
    {
      id: 'alternate',
      label: t('simbriefDialog.fuelTab.alternate'),
      value: data.fuel.alternate_burn,
      color: 'bg-primary/40',
    },
    {
      id: 'finalReserve',
      label: t('simbriefDialog.fuelTab.finalReserve'),
      value: data.fuel.reserve,
      color: 'bg-primary/40',
    },
    {
      id: 'extra',
      label: t('simbriefDialog.fuelTab.extra'),
      value: data.fuel.extra,
      color: 'bg-primary/40',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4">
        <h4 className="xp-section-heading mb-4">{t('simbriefDialog.fuelTab.breakdown')}</h4>
        <div className="space-y-3">
          {fuelItems.map((item) => {
            const amount = parseInt(item.value, 10);
            const percentage = totalFuel > 0 ? (amount / totalFuel) * 100 : 0;
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', item.color)} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono font-medium">{units.ofpWeight(item.value)}</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={cn('h-full', item.color)}
                    style={{ width: `${Math.max(percentage, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Total
          label={t('simbriefDialog.fuelTab.blockFuel')}
          value={units.ofpWeight(data.fuel.plan_ramp)}
          className="bg-primary/5 text-primary"
        />
        <Total
          label={t('simbriefDialog.fuelTab.takeoffFuel')}
          value={units.ofpWeight(data.fuel.plan_takeoff)}
        />
        <Total
          label={t('simbriefDialog.fuelTab.landingFuel')}
          value={units.ofpWeight(data.fuel.plan_landing)}
        />
      </div>
    </div>
  );
}

function Total({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('bg-card rounded-lg border p-3 text-center', className)}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold">{value}</p>
    </div>
  );
}

function WeightsColumn({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const units = useOfpUnits(apiUnit);
  const weights = [
    {
      label: t('simbriefDialog.weights.zfwFull'),
      abbr: t('simbriefDialog.weights.zfw'),
      est: parseInt(data.weights.est_zfw, 10),
      max: parseInt(data.weights.max_zfw, 10),
    },
    {
      label: t('simbriefDialog.weights.towFull'),
      abbr: t('simbriefDialog.weights.tow'),
      est: parseInt(data.weights.est_tow, 10),
      max: parseInt(data.weights.max_tow, 10),
    },
    {
      label: t('simbriefDialog.weights.ldwFull'),
      abbr: t('simbriefDialog.weights.ldw'),
      est: parseInt(data.weights.est_ldw, 10),
      max: parseInt(data.weights.max_ldw, 10),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4">
        <h4 className="xp-section-heading mb-4">{t('simbriefDialog.weightsTab.limits')}</h4>
        <div className="space-y-5">
          {weights.map((w) => {
            const percentage = w.max > 0 ? (w.est / w.max) * 100 : 0;
            const isWarning = percentage > 95;
            const isCritical = percentage > 100;
            return (
              <div key={w.abbr} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-sm font-bold">{w.abbr}</span>
                    <span className="text-muted-foreground truncate text-sm">{w.label}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        'font-mono text-sm font-medium',
                        isCritical && 'text-destructive',
                        isWarning && !isCritical && 'text-warning'
                      )}
                    >
                      {units.ofpWeight(w.est.toString())}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {' '}
                      / {units.ofpWeight(w.max.toString())}
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={cn(
                      'h-3',
                      isCritical && '[&>div]:bg-destructive',
                      isWarning && !isCritical && '[&>div]:bg-warning'
                    )}
                  />
                  <span className="text-foreground text-2xs absolute top-1/2 right-2 -translate-y-1/2 font-mono font-bold">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <h4 className="xp-section-heading mb-3">{t('simbriefDialog.weightsTab.operating')}</h4>
        <div className="space-y-2">
          <Row
            label={t('simbriefDialog.weightsTab.oew')}
            value={units.ofpWeight(data.weights.oew)}
          />
          <Row
            label={t('simbriefDialog.weightsTab.passengers')}
            value={t('simbriefDialog.weightsTab.paxCount', { count: data.weights.pax_count })}
          />
          <Row
            label={t('simbriefDialog.weightsTab.cargo')}
            value={units.ofpWeight(data.weights.cargo)}
          />
          <Row
            label={t('simbriefDialog.weightsTab.payload')}
            value={units.ofpWeight(data.weights.payload)}
          />
          <Separator />
          <Row
            label={t('simbriefDialog.weights.zfw')}
            value={units.ofpWeight(data.weights.est_zfw)}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
