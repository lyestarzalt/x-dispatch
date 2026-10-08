import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
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
      label: t('flightInfoPanel.fuelItems.taxi'),
      value: data.fuel.taxi,
      color: 'bg-muted-foreground',
    },
    {
      id: 'trip',
      label: t('flightInfoPanel.fuelItems.trip'),
      value: data.fuel.enroute_burn,
      color: 'bg-primary',
    },
    {
      id: 'contingency',
      label: t('flightInfoPanel.fuelItems.contingency'),
      value: data.fuel.contingency,
      color: 'bg-warning',
    },
    {
      id: 'alternate',
      label: t('flightInfoPanel.fuelItems.alternate'),
      value: data.fuel.alternate_burn,
      color: 'bg-warning',
    },
    {
      id: 'reserve',
      label: t('flightInfoPanel.fuelItems.reserve'),
      value: data.fuel.reserve,
      color: 'bg-destructive',
    },
    {
      id: 'extra',
      label: t('flightInfoPanel.fuelItems.extra'),
      value: data.fuel.extra,
      color: 'bg-success',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Fuel Breakdown */}
      {fuelItems.map((item) => {
        const amount = parseInt(item.value, 10);
        const percentage = (amount / totalFuel) * 100;
        if (amount === 0) return null;
        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', item.color)} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-mono font-medium">{formatFuel(item.value, apiUnit)}</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={cn('h-full transition-all', item.color)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}

      <Separator className="my-3" />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <p className="text-muted-foreground text-2xs">{t('flightInfoPanel.blockLabel')}</p>
          <p className="text-primary font-mono text-sm font-bold">
            {formatFuel(data.fuel.plan_ramp, apiUnit)}
          </p>
        </div>
        <div className="bg-success/10 rounded-lg p-3 text-center">
          <p className="text-muted-foreground text-2xs">{t('flightInfoPanel.landingLabel')}</p>
          <p className="text-success font-mono text-sm font-bold">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </p>
        </div>
      </div>
    </div>
  );
}
