import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/helpers';
import { formatFuel } from '@/queries/useSimbriefQuery';
import type { SimBriefOFP } from '@/types/simbrief';

// Fuel Tab
export function FuelTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const totalFuel = parseInt(data.fuel.plan_ramp, 10);
  const fuelItems = [
    {
      id: 'taxi',
      label: t('simbriefDialog.fuelTab.taxi'),
      value: data.fuel.taxi,
      color: 'bg-muted-foreground',
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
      color: 'bg-warning',
    },
    {
      id: 'alternate',
      label: t('simbriefDialog.fuelTab.alternate'),
      value: data.fuel.alternate_burn,
      color: 'bg-warning',
    },
    {
      id: 'finalReserve',
      label: t('simbriefDialog.fuelTab.finalReserve'),
      value: data.fuel.reserve,
      color: 'bg-destructive',
    },
    {
      id: 'extra',
      label: t('simbriefDialog.fuelTab.extra'),
      value: data.fuel.extra,
      color: 'bg-success',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Fuel Breakdown Visual */}
      <div className="bg-card rounded-lg border p-4">
        <h4 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
          {t('simbriefDialog.fuelTab.breakdown')}
        </h4>
        <div className="space-y-3">
          {fuelItems.map((item) => {
            const amount = parseInt(item.value, 10);
            const percentage = (amount / totalFuel) * 100;
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', item.color)} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono font-medium">{formatFuel(item.value, apiUnit)}</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={cn('h-full transition-all', item.color)}
                    style={{ width: `${Math.max(percentage, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fuel Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-primary/5 rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t('simbriefDialog.fuelTab.blockFuel')}
          </p>
          <p className="text-primary mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_ramp, apiUnit)}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t('simbriefDialog.fuelTab.takeoffFuel')}
          </p>
          <p className="mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_takeoff, apiUnit)}
          </p>
        </div>
        <div className="bg-success/5 rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t('simbriefDialog.fuelTab.landingFuel')}
          </p>
          <p className="text-success mt-1 font-mono text-xl font-bold">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </p>
        </div>
      </div>
    </div>
  );
}
