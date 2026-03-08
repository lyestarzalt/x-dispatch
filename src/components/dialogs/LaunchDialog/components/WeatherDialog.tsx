import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  ArrowUpDown,
  Cloud,
  Droplets,
  Eye,
  Gauge,
  Plus,
  Thermometer,
  Trash2,
  Waves,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import { useLaunchStore } from '@/stores/launchStore';
import type {
  CloudLayer,
  CoverageCategory,
  EvolutionEnum,
  TerrainState,
  WindLayer,
} from '../weatherTypes';
import {
  COVERAGE_CATEGORIES,
  EVOLUTION_OPTIONS,
  ISA_SEA_LEVEL_TEMP_C,
  STD_ALTIMETER_HPA,
  VISIBILITY_STOPS,
  celsiusToFahrenheit,
  findClosestVisibilityIndex,
  formatVisibility,
  getCategoryMidpoint,
  getCoverageCategory,
  hpaToInHg,
  kmToSM,
} from '../weatherTypes';
import { AltitudeDiagram, type SelectedLayer } from './AltitudeDiagram';

// ─── Props ──────────────────────────────────────────────────────────────────

interface WeatherDialogProps {
  open: boolean;
  onClose: () => void;
  airportElevationFt?: number;
}

// ─── Terrain two-step picker types ──────────────────────────────────────────

type TerrainCondition = 'dry' | 'wet' | 'puddles' | 'snow' | 'ice' | 'mix';
type TerrainIntensity = 'light' | 'medium' | 'heavy';

const TERRAIN_CONDITION_MAP: Record<
  TerrainCondition,
  TerrainState | Record<TerrainIntensity, TerrainState>
> = {
  dry: 'dry',
  wet: { light: 'lightly_wet', medium: 'medium_wet', heavy: 'very_wet' },
  puddles: { light: 'lightly_puddly', medium: 'medium_puddly', heavy: 'very_puddly' },
  snow: { light: 'lightly_snowy', medium: 'medium_snowy', heavy: 'very_snowy' },
  ice: { light: 'lightly_icy', medium: 'medium_icy', heavy: 'very_icy' },
  mix: {
    light: 'lightly_snowy_and_icy',
    medium: 'medium_snowy_and_icy',
    heavy: 'very_snowy_and_icy',
  },
};

function parseTerrainState(ts: TerrainState): {
  condition: TerrainCondition;
  intensity: TerrainIntensity;
} {
  if (ts === 'dry') return { condition: 'dry', intensity: 'medium' };
  for (const [cond, mapping] of Object.entries(TERRAIN_CONDITION_MAP)) {
    if (typeof mapping === 'object') {
      for (const [int, val] of Object.entries(mapping)) {
        if (val === ts)
          return { condition: cond as TerrainCondition, intensity: int as TerrainIntensity };
      }
    }
  }
  return { condition: 'dry', intensity: 'medium' };
}

function buildTerrainState(condition: TerrainCondition, intensity: TerrainIntensity): TerrainState {
  const mapping = TERRAIN_CONDITION_MAP[condition];
  if (typeof mapping === 'string') return mapping;
  return mapping[intensity];
}

// Cloud type keys for i18n
const CLOUD_TYPES: CloudLayer['type'][] = ['cirrus', 'stratus', 'cumulus', 'cumulonimbus'];
const TERRAIN_CONDITIONS: TerrainCondition[] = ['dry', 'wet', 'puddles', 'snow', 'ice', 'mix'];
const TERRAIN_INTENSITIES: TerrainIntensity[] = ['light', 'medium', 'heavy'];

// ─── Main Dialog ────────────────────────────────────────────────────────────

export function WeatherDialog({ open, onClose, airportElevationFt = 0 }: WeatherDialogProps) {
  const { t } = useTranslation();
  const weatherConfig = useLaunchStore((s) => s.weatherConfig);
  const updateCustomWeather = useLaunchStore((s) => s.updateCustomWeather);
  const addCloudLayer = useLaunchStore((s) => s.addCloudLayer);
  const removeCloudLayer = useLaunchStore((s) => s.removeCloudLayer);
  const updateCloudLayer = useLaunchStore((s) => s.updateCloudLayer);
  const addWindLayer = useLaunchStore((s) => s.addWindLayer);
  const removeWindLayer = useLaunchStore((s) => s.removeWindLayer);
  const updateWindLayer = useLaunchStore((s) => s.updateWindLayer);

  const { mode, custom } = weatherConfig;
  const isReal = mode === 'real';

  const [selectedLayer, setSelectedLayer] = useState<SelectedLayer | null>(null);

  const validSelection = (() => {
    if (!selectedLayer) return null;
    if (selectedLayer.kind === 'cloud' && selectedLayer.index < custom.clouds.length)
      return selectedLayer;
    if (selectedLayer.kind === 'wind' && selectedLayer.index < custom.wind.length)
      return selectedLayer;
    return null;
  })();

  const handleAddCloud = useCallback(() => {
    const nextIndex = custom.clouds.length;
    addCloudLayer();
    setSelectedLayer({ kind: 'cloud', index: nextIndex });
  }, [addCloudLayer, custom.clouds.length]);

  const handleAddWind = useCallback(() => {
    const nextIndex = custom.wind.length;
    addWindLayer();
    setSelectedLayer({ kind: 'wind', index: nextIndex });
  }, [addWindLayer, custom.wind.length]);

  const handleRemoveCloud = useCallback(
    (index: number) => {
      removeCloudLayer(index);
      setSelectedLayer(null);
    },
    [removeCloudLayer]
  );

  const handleRemoveWind = useCallback(
    (index: number) => {
      removeWindLayer(index);
      setSelectedLayer(null);
    },
    [removeWindLayer]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-8 z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{t('launcher.weatherDialog.title')}</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header */}
          <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4">
            <span className="text-sm font-medium">{t('launcher.weatherDialog.title')}</span>
            <div className="flex items-center gap-2">
              {!isReal && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddCloud}
                    disabled={custom.clouds.length >= 3}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('launcher.weatherDialog.addCloud')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddWind}
                    disabled={custom.wind.length >= 13}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('launcher.weatherDialog.addWind')}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body — 3 panel layout */}
          <div className="flex min-h-0 flex-1">
            {/* LEFT — Layer Properties */}
            <div
              className={cn(
                'w-[280px] shrink-0 overflow-y-auto border-r border-border p-4',
                isReal && 'pointer-events-none opacity-40'
              )}
            >
              <SectionHeader text={t('launcher.weatherDialog.layerProperties')} />
              {validSelection?.kind === 'cloud' ? (
                <CloudLayerProperties
                  index={validSelection.index}
                  layer={custom.clouds[validSelection.index]}
                  onUpdate={(data) => updateCloudLayer(validSelection.index, data)}
                  onRemove={() => handleRemoveCloud(validSelection.index)}
                />
              ) : validSelection?.kind === 'wind' ? (
                <WindLayerProperties
                  index={validSelection.index}
                  layer={custom.wind[validSelection.index]}
                  onUpdate={(data) => updateWindLayer(validSelection.index, data)}
                  onRemove={() => handleRemoveWind(validSelection.index)}
                />
              ) : (
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  {t('launcher.weatherDialog.emptyHint')}
                </p>
              )}
            </div>

            {/* CENTER — Altitude Diagram */}
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col p-2',
                isReal && 'pointer-events-none opacity-40'
              )}
            >
              <AltitudeDiagram
                clouds={custom.clouds}
                wind={custom.wind}
                airportElevationFt={airportElevationFt}
                selectedLayer={validSelection}
                onSelectLayer={setSelectedLayer}
                onUpdateCloud={(i, data) => updateCloudLayer(i, data)}
                onUpdateWind={(i, data) => updateWindLayer(i, data)}
                disabled={isReal}
              />
            </div>

            {/* RIGHT — Atmospheric + Environment */}
            <div className="w-[320px] shrink-0 overflow-y-auto border-l border-border p-4">
              <AtmosphericPanel custom={custom} isReal={isReal} onUpdate={updateCustomWeather} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-shrink-0 justify-end border-t border-border bg-card px-4 py-2.5">
            <Button onClick={onClose} size="sm">
              {t('launcher.weatherDialog.done')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {text}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Unit Toggle ────────────────────────────────────────────────────────────

function UnitToggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string];
  onChange: (v: string) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="subtle"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      className="gap-1"
    >
      {options.map((opt) => (
        <ToggleGroupItem key={opt} value={opt} className="h-6 px-2 text-xs">
          {opt}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

// ─── Cloud Layer Properties ─────────────────────────────────────────────────

function CloudLayerProperties({
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
  const category = getCoverageCategory(layer.cover);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        {/* Cloud Type */}
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">
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
          <Label className="text-sm text-muted-foreground">
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
            <span className="font-mono text-foreground">
              {layer.tops_ft.toLocaleString()} ft MSL
            </span>
          </div>
          <Slider
            value={[layer.tops_ft]}
            onValueChange={(v) => onUpdate({ tops_ft: Math.max(v[0], layer.base_ft + 500) })}
            min={500}
            max={50000}
            step={500}
          />
        </div>

        {/* Bases */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.bases')}</span>
            <span className="font-mono text-foreground">
              {layer.base_ft.toLocaleString()} ft MSL
            </span>
          </div>
          <Slider
            value={[layer.base_ft]}
            onValueChange={(v) => {
              const base = v[0];
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
        className="mt-4 w-full gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t('launcher.weatherDialog.deleteCloud', { n: index + 1 })}
      </Button>
    </div>
  );
}

// ─── Wind Layer Properties ──────────────────────────────────────────────────

function WindLayerProperties({
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.altitude')}</span>
            <span className="font-mono text-foreground">
              {layer.altitude_ft.toLocaleString()} ft MSL
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
            <span className="font-mono text-foreground">
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
            <span className="font-mono text-foreground">{layer.speed_kts} kts</span>
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
            <span className="font-mono text-foreground">
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
            <span className="font-mono text-foreground">{layer.shear_deg}&deg;</span>
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
            <span className="font-mono text-foreground">{Math.round(layer.turbulence * 100)}%</span>
          </div>
          <Slider
            value={[layer.turbulence * 100]}
            onValueChange={(v) => onUpdate({ turbulence: v[0] / 100 })}
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
        className="mt-4 w-full gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t('launcher.weatherDialog.deleteWind', { n: index + 1 })}
      </Button>
    </div>
  );
}

// ─── Atmospheric Panel (Right) ──────────────────────────────────────────────

function AtmosphericPanel({
  custom,
  isReal,
  onUpdate,
}: {
  custom: import('../weatherTypes').CustomWeatherState;
  isReal: boolean;
  onUpdate: (partial: Partial<import('../weatherTypes').CustomWeatherState>) => void;
}) {
  const { t } = useTranslation();
  const visibilityIndex = findClosestVisibilityIndex(custom.visibility_km);

  const [visUnit, setVisUnit] = useState<'km' | 'SM'>('km');
  const [tempUnit, setTempUnit] = useState<'°C' | '°F'>('°C');
  const [altUnit, setAltUnit] = useState<'hPa' | 'inHg'>('inHg');

  const visDisplay =
    visUnit === 'km'
      ? formatVisibility(custom.visibility_km)
      : `${kmToSM(custom.visibility_km).toFixed(1)} SM`;

  const tempDisplay =
    tempUnit === '°C'
      ? `${custom.temperature_c}°C`
      : `${Math.round(celsiusToFahrenheit(custom.temperature_c))}°F`;

  const altDisplay =
    altUnit === 'inHg'
      ? `${hpaToInHg(custom.altimeter_hpa).toFixed(2)} inHg`
      : `${custom.altimeter_hpa} hPa`;

  const altSubtext =
    altUnit === 'inHg'
      ? `SLP ${custom.altimeter_hpa} hPa${custom.altimeter_hpa === STD_ALTIMETER_HPA ? ' (STD)' : ''}`
      : `${hpaToInHg(custom.altimeter_hpa).toFixed(2)} inHg${custom.altimeter_hpa === STD_ALTIMETER_HPA ? ' (STD)' : ''}`;

  // Parse terrain state into condition + intensity for two-step picker
  const { condition: terrainCondition, intensity: terrainIntensity } = useMemo(
    () => parseTerrainState(custom.terrain_state),
    [custom.terrain_state]
  );

  const handleTerrainCondition = useCallback(
    (cond: TerrainCondition) => {
      // When switching condition, keep current intensity (or default to medium for dry→non-dry)
      const newState = buildTerrainState(cond, cond === 'dry' ? 'medium' : terrainIntensity);
      onUpdate({ terrain_state: newState });
    },
    [terrainIntensity, onUpdate]
  );

  const handleTerrainIntensity = useCallback(
    (int: TerrainIntensity) => {
      const newState = buildTerrainState(terrainCondition, int);
      onUpdate({ terrain_state: newState });
    },
    [terrainCondition, onUpdate]
  );

  return (
    <div className={cn(isReal && 'pointer-events-none opacity-40', 'space-y-5')}>
      <SectionHeader text={t('launcher.weatherDialog.atmosphere')} />

      {/* Visibility */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            {t('launcher.weatherDialog.visibility')}
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={visUnit}
              options={['km', 'SM']}
              onChange={(v) => setVisUnit(v as 'km' | 'SM')}
            />
            <span className="w-20 text-right font-mono text-foreground">{visDisplay}</span>
          </div>
        </div>
        <Slider
          value={[visibilityIndex]}
          onValueChange={(v) => onUpdate({ visibility_km: VISIBILITY_STOPS[v[0]] })}
          min={0}
          max={VISIBILITY_STOPS.length - 1}
          step={1}
        />
      </div>

      {/* Precipitation */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Droplets className="h-4 w-4" />
            {t('launcher.weatherDialog.precipitation')}
          </span>
          <span className="font-mono text-foreground">
            {custom.precipitation === 0
              ? t('launcher.weatherDialog.precipNone')
              : custom.precipitation >= 0.8
                ? t('launcher.weatherDialog.precipSevere')
                : `${Math.round(custom.precipitation * 100)}%`}
          </span>
        </div>
        <Slider
          value={[custom.precipitation * 100]}
          onValueChange={(v) => onUpdate({ precipitation: v[0] / 100 })}
          min={0}
          max={100}
          step={5}
        />
      </div>

      {/* Temperature */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Thermometer className="h-4 w-4" />
            {t('launcher.weatherDialog.temperature')}
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={tempUnit}
              options={['°C', '°F']}
              onChange={(v) => setTempUnit(v as '°C' | '°F')}
            />
            <span className="w-14 text-right font-mono text-foreground">{tempDisplay}</span>
          </div>
        </div>
        <Slider
          value={[custom.temperature_c]}
          onValueChange={(v) => onUpdate({ temperature_c: v[0] })}
          min={-50}
          max={58}
          step={1}
        />
        <span className="text-xs text-muted-foreground">
          ISA {custom.temperature_c >= ISA_SEA_LEVEL_TEMP_C ? '+' : ''}
          {custom.temperature_c - ISA_SEA_LEVEL_TEMP_C}&deg;C
        </span>
      </div>

      {/* Altimeter Setting */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Gauge className="h-4 w-4" />
            {t('launcher.weatherDialog.altimeter')}
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={altUnit}
              options={['hPa', 'inHg']}
              onChange={(v) => setAltUnit(v as 'hPa' | 'inHg')}
            />
            <span className="w-20 text-right font-mono text-foreground">{altDisplay}</span>
          </div>
        </div>
        <Slider
          value={[custom.altimeter_hpa]}
          onValueChange={(v) => onUpdate({ altimeter_hpa: Math.round(v[0] * 4) / 4 })}
          min={940}
          max={1075}
          step={0.25}
        />
        <span className="text-xs text-muted-foreground">{altSubtext}</span>
      </div>

      {/* ── ENVIRONMENT ── */}
      <SectionHeader text={t('launcher.weatherDialog.environment')} />

      {/* Terrain — two-step cascading picker */}
      <div className="space-y-2.5">
        <span className="text-sm text-muted-foreground">{t('launcher.weatherDialog.terrain')}</span>

        {/* Step 1: Condition type */}
        <ToggleGroup
          type="single"
          variant="subtle"
          value={terrainCondition}
          onValueChange={(v) => {
            if (v) handleTerrainCondition(v as TerrainCondition);
          }}
          className="grid grid-cols-3 gap-1.5"
        >
          {TERRAIN_CONDITIONS.map((cond) => (
            <ToggleGroupItem key={cond} value={cond} className="h-8 text-sm">
              {t(`launcher.weatherDialog.terrainConditions.${cond}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Step 2: Intensity (hidden when Dry) */}
        {terrainCondition !== 'dry' && (
          <ToggleGroup
            type="single"
            variant="subtle"
            value={terrainIntensity}
            onValueChange={(v) => {
              if (v) handleTerrainIntensity(v as TerrainIntensity);
            }}
            className="grid grid-cols-3 gap-1.5"
          >
            {TERRAIN_INTENSITIES.map((int) => (
              <ToggleGroupItem key={int} value={int} className="h-8 text-sm">
                {t(`launcher.weatherDialog.terrainIntensities.${int}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {/* Waves */}
      <div className="space-y-2">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Waves className="h-4 w-4" />
          {t('launcher.weatherDialog.waves')}
        </span>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.waveHeight')}</span>
            <span className="font-mono text-foreground">{custom.wave_height_m.toFixed(1)} m</span>
          </div>
          <Slider
            value={[custom.wave_height_m]}
            onValueChange={(v) => onUpdate({ wave_height_m: Math.round(v[0] * 10) / 10 })}
            min={0}
            max={12}
            step={0.1}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('launcher.weatherDialog.waveDirection')}
            </span>
            <span className="font-mono text-foreground">
              {String(Math.round(custom.wave_direction_deg)).padStart(3, '0')}&deg;
            </span>
          </div>
          <Slider
            value={[custom.wave_direction_deg]}
            onValueChange={(v) => onUpdate({ wave_direction_deg: v[0] })}
            min={0}
            max={360}
            step={5}
          />
        </div>
      </div>

      {/* Thermals */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <ArrowUpDown className="h-4 w-4" />
            {t('launcher.weatherDialog.thermals')}
          </span>
          <span className="font-mono text-foreground">
            {custom.thermal_fpm === 0
              ? t('launcher.weatherDialog.thermalsNone')
              : `${custom.thermal_fpm} fpm`}
          </span>
        </div>
        <Slider
          value={[custom.thermal_fpm]}
          onValueChange={(v) => onUpdate({ thermal_fpm: v[0] })}
          min={0}
          max={2000}
          step={50}
        />
      </div>

      {/* Regional Variation */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Cloud className="h-4 w-4" />
            {t('launcher.weatherDialog.variation')}
          </span>
          <span className="font-mono text-foreground">{Math.round(custom.variation_pct)}%</span>
        </div>
        <Slider
          value={[custom.variation_pct]}
          onValueChange={(v) => onUpdate({ variation_pct: v[0] })}
          min={0}
          max={100}
          step={5}
        />
      </div>

      {/* Evolution — Select dropdown */}
      <div className="space-y-1.5">
        <span className="text-sm text-muted-foreground">
          {t('launcher.weatherDialog.evolution')}
        </span>
        <Select
          value={custom.evolution}
          onValueChange={(v) => onUpdate({ evolution: v as EvolutionEnum })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVOLUTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {t(`launcher.weatherDialog.evolutionOptions.${opt.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
