import { useCallback, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  Cloud,
  Droplets,
  Eye,
  Gauge,
  Plus,
  Thermometer,
  Trash2,
  Trees,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import { useLaunchStore } from '@/stores/launchStore';
import type { CloudLayer, CoverageCategory, WindLayer } from '../weatherTypes';
import {
  CLOUD_TYPE_LABELS,
  COVERAGE_CATEGORIES,
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

// ─── Terrain options ────────────────────────────────────────────────────────

const TERRAIN_OPTIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'wet', label: 'Wet' },
  { value: 'snowy', label: 'Snow' },
  { value: 'icy', label: 'Icy' },
] as const;

// ─── Main Dialog ────────────────────────────────────────────────────────────

export function WeatherDialog({ open, onClose, airportElevationFt = 0 }: WeatherDialogProps) {
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

  // Bounds check for selection
  const validSelection = (() => {
    if (!selectedLayer) return null;
    if (selectedLayer.kind === 'cloud' && selectedLayer.index < custom.clouds.length)
      return selectedLayer;
    if (selectedLayer.kind === 'wind' && selectedLayer.index < custom.wind.length)
      return selectedLayer;
    return null;
  })();

  // Add + auto-select the new layer
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
          className="fixed left-[50%] top-[50%] z-[60] flex w-[1100px] max-w-[95vw] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Weather Settings</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header — title + add layer buttons */}
          <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4">
            <span className="text-sm font-medium">Weather Settings</span>
            <div className="flex items-center gap-2">
              {!isReal && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddCloud}
                    disabled={custom.clouds.length >= 3}
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Cloud Layer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddWind}
                    disabled={custom.wind.length >= 13}
                    className="h-7 gap-1 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    Wind Layer
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body — 3 panel layout */}
          <div className="flex" style={{ height: 640 }}>
            {/* LEFT — Layer Properties */}
            <div
              className={cn(
                'w-[260px] shrink-0 overflow-y-auto border-r border-border p-4',
                isReal && 'pointer-events-none opacity-40'
              )}
            >
              <SectionHeader text="Layer Properties" />
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
                <p className="mt-8 text-center text-xs text-muted-foreground">
                  Click a cloud or wind layer in the diagram to edit
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

            {/* RIGHT — Atmospheric + Runway Conditions */}
            <div className="w-[270px] shrink-0 overflow-y-auto border-l border-border p-4">
              <AtmosphericPanel custom={custom} isReal={isReal} onUpdate={updateCustomWeather} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-border bg-card px-4 py-2.5">
            <Button onClick={onClose} size="sm">
              Done
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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
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
      className="gap-0.5"
    >
      {options.map((opt) => (
        <ToggleGroupItem key={opt} value={opt} className="h-5 px-1.5 text-[10px]">
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
  const category = getCoverageCategory(layer.cover);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        {/* Cloud Type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cloud Type</Label>
          <ToggleGroup
            type="single"
            variant="subtle"
            value={layer.type}
            onValueChange={(v) => {
              if (v) onUpdate({ type: v as CloudLayer['type'] });
            }}
            className="grid grid-cols-1 gap-1"
          >
            {(Object.entries(CLOUD_TYPE_LABELS) as [CloudLayer['type'], string][]).map(
              ([value, label]) => (
                <ToggleGroupItem key={value} value={value} className="h-8 text-xs">
                  {label}
                </ToggleGroupItem>
              )
            )}
          </ToggleGroup>
        </div>

        {/* Cloud Coverage */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cloud Coverage</Label>
          <ToggleGroup
            type="single"
            variant="subtle"
            value={category}
            onValueChange={(v) => {
              if (v) onUpdate({ cover: getCategoryMidpoint(v as CoverageCategory) });
            }}
            className="grid grid-cols-1 gap-1"
          >
            {COVERAGE_CATEGORIES.map((cat) => (
              <ToggleGroupItem key={cat.key} value={cat.key} className="h-8 text-xs">
                {cat.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Tops */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tops</span>
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Bases</span>
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
        className="mt-4 w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
        Delete Cloud Layer {index + 1}
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
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Altitude</span>
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Direction</span>
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Speed</span>
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gusts</span>
            <span className="font-mono text-foreground">
              {layer.gust_kts > 0 ? `+${layer.gust_kts} kts` : 'None'}
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Shear</span>
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
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Turbulence</span>
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
        className="mt-4 w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
        Delete Wind Layer {index + 1}
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
  const visibilityIndex = findClosestVisibilityIndex(custom.visibility_km);

  // Unit toggles (visual only — values are always stored in metric)
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

  return (
    <div className={cn(isReal && 'pointer-events-none opacity-40', 'space-y-5')}>
      <SectionHeader text="Atmospheric Conditions" />

      {/* Visibility */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="h-3 w-3" />
            Visibility
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={visUnit}
              options={['km', 'SM']}
              onChange={(v) => setVisUnit(v as 'km' | 'SM')}
            />
            <span className="w-16 text-right font-mono text-foreground">{visDisplay}</span>
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
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="h-3 w-3" />
            Precipitation
          </span>
          <span className="font-mono text-foreground">
            {custom.precipitation === 0
              ? 'None'
              : custom.precipitation >= 0.8
                ? 'Severe'
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
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Thermometer className="h-3 w-3" />
            Airport Temperature
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={tempUnit}
              options={['°C', '°F']}
              onChange={(v) => setTempUnit(v as '°C' | '°F')}
            />
            <span className="w-12 text-right font-mono text-foreground">{tempDisplay}</span>
          </div>
        </div>
        <Slider
          value={[custom.temperature_c]}
          onValueChange={(v) => onUpdate({ temperature_c: v[0] })}
          min={-50}
          max={58}
          step={1}
        />
        <span className="text-[10px] text-muted-foreground">
          ISA {custom.temperature_c >= ISA_SEA_LEVEL_TEMP_C ? '+' : ''}
          {custom.temperature_c - ISA_SEA_LEVEL_TEMP_C}&deg;C
        </span>
      </div>

      {/* Altimeter Setting */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="h-3 w-3" />
            Altimeter Setting
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={altUnit}
              options={['hPa', 'inHg']}
              onChange={(v) => setAltUnit(v as 'hPa' | 'inHg')}
            />
            <span className="w-16 text-right font-mono text-foreground">{altDisplay}</span>
          </div>
        </div>
        <Slider
          value={[custom.altimeter_hpa]}
          onValueChange={(v) => onUpdate({ altimeter_hpa: Math.round(v[0] * 4) / 4 })}
          min={940}
          max={1075}
          step={0.25}
        />
        <span className="text-[10px] text-muted-foreground">{altSubtext}</span>
      </div>

      {/* ── RUNWAY AND WATER CONDITIONS ── */}
      <SectionHeader text="Runway & Water" />

      {/* Terrain / Runway Wetness */}
      <div className="space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Trees className="h-3 w-3" />
          Runway Wetness
        </span>
        <ToggleGroup
          type="single"
          variant="subtle"
          value={custom.terrain_state}
          onValueChange={(v) => {
            if (v) onUpdate({ terrain_state: v as 'dry' | 'wet' | 'snowy' | 'icy' });
          }}
          className="grid grid-cols-4 gap-1"
        >
          {TERRAIN_OPTIONS.map((opt) => (
            <ToggleGroupItem key={opt.value} value={opt.value} className="h-7 px-1 text-xs">
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Wave info */}
      {custom.wind.length > 0 && (
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Waves className="h-3 w-3" />
            Wave Conditions
          </span>
          <div className="rounded-md bg-secondary/40 px-2.5 py-2 text-xs text-muted-foreground">
            {Math.max(0.5, custom.wind[0].speed_kts * 0.15).toFixed(1)} m height ·{' '}
            {Math.round(custom.wind[0].direction_deg)}&deg; direction
          </div>
        </div>
      )}
    </div>
  );
}
