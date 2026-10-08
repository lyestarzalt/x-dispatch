import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnits } from '@/hooks/useUnits';
import type { Feet } from '@/lib/utils/geomath';
import type { CloudLayer, CoverageCategory } from '../../weatherTypes';
import { COVERAGE_CATEGORIES, getCategoryMidpoint, getCoverageCategory } from '../../weatherTypes';

// Cloud type keys for i18n
const CLOUD_TYPES: CloudLayer['type'][] = ['cirrus', 'stratus', 'cumulus', 'cumulonimbus'];

// ─── Cloud Layer Properties ─────────────────────────────────────────────────

export function CloudLayerProperties({
  index,
  layer,
  onUpdate,
  onRemove,
}: {
  index: number;
  layer: CloudLayer;
  onUpdate: (data: Partial<CloudLayer>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const units = useUnits();
  const category = getCoverageCategory(layer.cover);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        {/* Cloud Type */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-sm">
            {t('launcher.weatherDialog.cloudType')}
          </Label>
          <ToggleGroup
            type="single"
            variant="subtle"
            value={layer.type}
            onValueChange={(v) => {
              if (v) onUpdate({ type: v as CloudLayer['type'] });
            }}
            className="grid grid-cols-1 gap-1.5"
          >
            {CLOUD_TYPES.map((type) => (
              <ToggleGroupItem key={type} value={type} className="h-9 text-sm">
                {t(`launcher.weatherDialog.cloudTypes.${type}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Cloud Coverage */}
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-sm">
            {t('launcher.weatherDialog.cloudCoverage')}
          </Label>
          <ToggleGroup
            type="single"
            variant="subtle"
            value={category}
            onValueChange={(v) => {
              if (v) onUpdate({ cover: getCategoryMidpoint(v as CoverageCategory) });
            }}
            className="grid grid-cols-1 gap-1.5"
          >
            {COVERAGE_CATEGORIES.map((cat) => (
              <ToggleGroupItem key={cat.key} value={cat.key} className="h-9 text-sm">
                {t(`launcher.weatherDialog.coverageCategories.${cat.key}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Tops */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.tops')}</span>
            <span className="text-foreground font-mono">
              {t('launcher.weatherDialog.ftMsl', { value: units.altitude(layer.tops_ft as Feet) })}
            </span>
          </div>
          <Slider
            value={[layer.tops_ft]}
            onValueChange={(v) => {
              const val = v[0];
              if (val === undefined) return;
              onUpdate({ tops_ft: Math.max(val, layer.base_ft + 500) });
            }}
            min={500}
            max={50000}
            step={500}
          />
        </div>

        {/* Bases */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.bases')}</span>
            <span className="text-foreground font-mono">
              {t('launcher.weatherDialog.ftMsl', { value: units.altitude(layer.base_ft as Feet) })}
            </span>
          </div>
          <Slider
            value={[layer.base_ft]}
            onValueChange={(v) => {
              const base = v[0];
              if (base === undefined) return;
              onUpdate({ base_ft: base, tops_ft: Math.max(layer.tops_ft, base + 500) });
            }}
            min={0}
            max={49500}
            step={500}
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
        {t('launcher.weatherDialog.deleteCloud', { n: index + 1 })}
      </Button>
    </div>
  );
}
