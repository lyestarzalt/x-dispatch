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
      {/* Weight Gauges */}
      <div className="bg-card rounded-lg border p-4">
        <h4 className="text-muted-foreground mb-4 text-xs font-medium tracking-wider uppercase">
          {t('simbriefDialog.weightsTab.limits')}
        </h4>
        <div className="space-y-5">
          {weights.map((w) => {
            const percentage = (w.est / w.max) * 100;
            const isWarning = percentage > 95;
            const isCritical = percentage > 100;
            return (
              <div key={w.abbr} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{w.abbr}</span>
                    <span className="text-muted-foreground text-sm">{w.label}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'font-mono text-sm font-medium',
                        isCritical && 'text-destructive',
                        isWarning && !isCritical && 'text-warning'
                      )}
                    >
                      {formatWeight(w.est.toString(), apiUnit)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {' '}
                      / {formatWeight(w.max.toString(), apiUnit)}
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

      {/* Weight Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.weightsTab.operating')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('simbriefDialog.weightsTab.oew')}</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.oew, apiUnit)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('simbriefDialog.weightsTab.payload')}
              </span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.payload, apiUnit)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('simbriefDialog.weights.zfw')}</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.est_zfw, apiUnit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h4 className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase">
            {t('simbriefDialog.weightsTab.details')}
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('simbriefDialog.weightsTab.passengers')}
              </span>
              <span className="font-mono font-medium">
                {t('simbriefDialog.weightsTab.paxCount', { count: data.weights.pax_count })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('simbriefDialog.weightsTab.cargo')}</span>
              <span className="font-mono font-medium">
                {formatWeight(data.weights.cargo, apiUnit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
