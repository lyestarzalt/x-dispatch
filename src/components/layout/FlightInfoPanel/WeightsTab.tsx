import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import { formatWeight } from '@/queries/useSimbriefQuery';
import type { SimBriefOFP } from '@/types/simbrief';

// Weights Tab
export function WeightsTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const weights = [
    {
      label: t('simbriefDialog.weights.zfw'),
      est: parseInt(data.weights.est_zfw, 10),
      max: parseInt(data.weights.max_zfw, 10),
    },
    {
      label: t('simbriefDialog.weights.tow'),
      est: parseInt(data.weights.est_tow, 10),
      max: parseInt(data.weights.max_tow, 10),
    },
    {
      label: t('simbriefDialog.weights.ldw'),
      est: parseInt(data.weights.est_ldw, 10),
      max: parseInt(data.weights.max_ldw, 10),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Weight Gauges */}
      {weights.map((w) => {
        const percentage = (w.est / w.max) * 100;
        const isWarning = percentage > 95;
        const isCritical = percentage > 100;
        return (
          <div key={w.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-mono font-medium">{w.label}</span>
              <div>
                <span
                  className={cn(
                    'font-mono font-medium',
                    isCritical && 'text-destructive',
                    isWarning && !isCritical && 'text-warning'
                  )}
                >
                  {formatWeight(w.est.toString(), apiUnit)}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  / {formatWeight(w.max.toString(), apiUnit)}
                </span>
              </div>
            </div>
            <Progress
              value={Math.min(percentage, 100)}
              className={cn(
                'h-2',
                isCritical && '[&>div]:bg-destructive',
                isWarning && !isCritical && '[&>div]:bg-warning'
              )}
            />
            <p className="text-muted-foreground text-2xs text-right">{percentage.toFixed(1)}%</p>
          </div>
        );
      })}

      <Separator className="my-3" />

      {/* Payload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('simbriefDialog.weightsTab.oew')}</span>
          <span className="font-mono font-medium">{formatWeight(data.weights.oew, apiUnit)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flightInfoPanel.passengers')}</span>
          <span className="font-mono font-medium">{data.weights.pax_count}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flightInfoPanel.cargo')}</span>
          <span className="font-mono font-medium">{formatWeight(data.weights.cargo, apiUnit)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flightInfoPanel.payload')}</span>
          <span className="font-mono font-medium">
            {formatWeight(data.weights.payload, apiUnit)}
          </span>
        </div>
      </div>
    </div>
  );
}
