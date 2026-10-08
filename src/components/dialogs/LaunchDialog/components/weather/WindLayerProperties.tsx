import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useUnits } from '@/hooks/useUnits';
import type { Feet } from '@/lib/utils/geomath';
import type { WindLayer } from '../../weatherTypes';

// ─── Wind Layer Properties ──────────────────────────────────────────────────

export function WindLayerProperties({
  index,
  layer,
  onUpdate,
  onRemove,
}: {
  index: number;
  layer: WindLayer;
  onUpdate: (data: Partial<WindLayer>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const units = useUnits();

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.altitude')}</span>
            <span className="text-foreground font-mono">
              {t('launcher.weatherDialog.ftMsl', {
                value: units.altitude(layer.altitude_ft as Feet),
              })}
            </span>
          </div>
          <Slider
            value={[layer.altitude_ft]}
            onValueChange={(v) => onUpdate({ altitude_ft: v[0] })}
            min={0}
            max={50000}
            step={500}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.direction')}</span>
            <span className="text-foreground font-mono">
              {String(Math.round(layer.direction_deg)).padStart(3, '0')}&deg;
            </span>
          </div>
          <Slider
            value={[layer.direction_deg]}
            onValueChange={(v) => onUpdate({ direction_deg: v[0] })}
            min={0}
            max={360}
            step={5}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.speed')}</span>
            <span className="text-foreground font-mono">{layer.speed_kts} kts</span>
          </div>
          <Slider
            value={[layer.speed_kts]}
            onValueChange={(v) => onUpdate({ speed_kts: v[0] })}
            min={0}
            max={200}
            step={1}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.gusts')}</span>
            <span className="text-foreground font-mono">
              {layer.gust_kts > 0
                ? `+${layer.gust_kts} kts`
                : t('launcher.weatherDialog.precipNone')}
            </span>
          </div>
          <Slider
            value={[layer.gust_kts]}
            onValueChange={(v) => onUpdate({ gust_kts: v[0] })}
            min={0}
            max={50}
            step={1}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.shear')}</span>
            <span className="text-foreground font-mono">{layer.shear_deg}&deg;</span>
          </div>
          <Slider
            value={[layer.shear_deg]}
            onValueChange={(v) => onUpdate({ shear_deg: v[0] })}
            min={0}
            max={180}
            step={5}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.turbulence')}</span>
            <span className="text-foreground font-mono">{Math.round(layer.turbulence * 100)}%</span>
          </div>
          <Slider
            value={[layer.turbulence * 100]}
            onValueChange={(v) => {
              const val = v[0];
              if (val === undefined) return;
              onUpdate({ turbulence: val / 100 });
            }}
            min={0}
            max={100}
            step={5}
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRemove}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive mt-4 w-full gap-2 text-sm"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t('launcher.weatherDialog.deleteWind', { n: index + 1 })}
      </Button>
    </div>
  );
}
