import { useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Eye,
  Globe,
  Layers,
  Plus,
  RotateCcw,
  Sun,
  Thermometer,
  Trees,
  Wind,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils/helpers';
import { useLaunchStore } from '@/stores/launchStore';
import { WEATHER_OPTIONS } from '../types';
import type { CloudLayer } from '../weatherTypes';
import {
  CLOUD_TYPE_LABELS,
  VISIBILITY_STOPS,
  findClosestVisibilityIndex,
  formatVisibility,
  formatWind,
} from '../weatherTypes';

interface WeatherDialogProps {
  open: boolean;
  onClose: () => void;
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  real: Globe,
  clear: Sun,
  cloudy: CloudSun,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: CloudSnow,
  foggy: CloudFog,
};

const WEATHER_LABELS: Record<string, string> = {
  real: 'Real',
  clear: 'Clear',
  cloudy: 'Cloudy',
  rainy: 'Rainy',
  stormy: 'Stormy',
  snowy: 'Snowy',
  foggy: 'Foggy',
};

const TERRAIN_OPTIONS = [
  { value: 'dry', label: 'Dry' },
  { value: 'wet', label: 'Wet' },
  { value: 'snowy', label: 'Snowy' },
  { value: 'icy', label: 'Icy' },
] as const;

export function WeatherDialog({ open, onClose }: WeatherDialogProps) {
  const weatherConfig = useLaunchStore((s) => s.weatherConfig);
  const setWeatherPreset = useLaunchStore((s) => s.setWeatherPreset);
  const updateCustomWeather = useLaunchStore((s) => s.updateCustomWeather);
  const addCloudLayer = useLaunchStore((s) => s.addCloudLayer);
  const removeCloudLayer = useLaunchStore((s) => s.removeCloudLayer);
  const updateCloudLayer = useLaunchStore((s) => s.updateCloudLayer);

  const { mode, preset, custom } = weatherConfig;
  const isReal = mode === 'real';

  const handleReset = useCallback(() => {
    const p = preset === 'real' ? 'clear' : preset;
    setWeatherPreset(p);
  }, [preset, setWeatherPreset]);

  const visibilityIndex = findClosestVisibilityIndex(custom.visibility_km);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[60] flex w-[720px] max-w-[95vw] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Weather</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header */}
          <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4">
            <span className="text-sm font-medium">Weather</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex min-h-0 gap-0">
            {/* Left: Controls */}
            <div
              className="min-w-0 flex-1 space-y-5 overflow-y-auto border-r border-border p-5"
              style={{ maxHeight: '65vh' }}
            >
              {/* Preset Grid */}
              <section>
                <div className="mb-3 flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Presets
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {WEATHER_OPTIONS.map((w) => {
                    const Icon = WEATHER_ICONS[w] || Cloud;
                    const isActive =
                      (w === 'real' && mode === 'real') ||
                      (w !== 'real' && mode === 'preset' && preset === w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWeatherPreset(w)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          isActive
                            ? 'bg-primary/10 text-primary ring-2 ring-primary'
                            : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{WEATHER_LABELS[w]}</span>
                      </button>
                    );
                  })}
                </div>
                {mode === 'custom' && (
                  <p className="mt-2 text-xs text-primary">Customized (based on {preset})</p>
                )}
              </section>

              {/* Atmosphere */}
              <section className={cn(isReal && 'pointer-events-none opacity-40')}>
                <div className="mb-3 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Atmosphere
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Visibility */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Visibility</span>
                      <span className="font-mono">{formatVisibility(custom.visibility_km)}</span>
                    </div>
                    <Slider
                      value={[visibilityIndex]}
                      onValueChange={(v) =>
                        updateCustomWeather({ visibility_km: VISIBILITY_STOPS[v[0]] })
                      }
                      min={0}
                      max={VISIBILITY_STOPS.length - 1}
                      step={1}
                    />
                  </div>

                  {/* Precipitation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Droplets className="h-3 w-3" />
                        Precipitation
                      </span>
                      <span className="font-mono">{Math.round(custom.precipitation * 100)}%</span>
                    </div>
                    <Slider
                      value={[custom.precipitation * 100]}
                      onValueChange={(v) => updateCustomWeather({ precipitation: v[0] / 100 })}
                      min={0}
                      max={100}
                      step={5}
                    />
                  </div>

                  {/* Temperature Offset */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Thermometer className="h-3 w-3" />
                        Temp Offset (ISA)
                      </span>
                      <span className="font-mono">
                        {custom.temperature_offset_c >= 0 ? '+' : ''}
                        {custom.temperature_offset_c}&deg;C
                      </span>
                    </div>
                    <Slider
                      value={[custom.temperature_offset_c]}
                      onValueChange={(v) => updateCustomWeather({ temperature_offset_c: v[0] })}
                      min={-40}
                      max={40}
                      step={1}
                    />
                  </div>

                  {/* Terrain State */}
                  <div className="space-y-1.5">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Trees className="h-3 w-3" />
                      Terrain
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {TERRAIN_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateCustomWeather({ terrain_state: opt.value })}
                          className={cn(
                            'rounded-md px-2 py-1.5 text-xs transition-all',
                            custom.terrain_state === opt.value
                              ? 'bg-primary/10 text-primary ring-1 ring-primary'
                              : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Surface Wind */}
              <section className={cn(isReal && 'pointer-events-none opacity-40')}>
                <div className="mb-3 flex items-center gap-1.5">
                  <Wind className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Surface Wind
                  </span>
                </div>
                <div className="space-y-4">
                  {/* Direction */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Direction</span>
                      <span className="font-mono">
                        {String(Math.round(custom.wind_direction_deg)).padStart(3, '0')}&deg;
                      </span>
                    </div>
                    <Slider
                      value={[custom.wind_direction_deg]}
                      onValueChange={(v) => updateCustomWeather({ wind_direction_deg: v[0] })}
                      min={0}
                      max={360}
                      step={5}
                    />
                  </div>

                  {/* Speed */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Speed</span>
                      <span className="font-mono">{custom.wind_speed_kts} kts</span>
                    </div>
                    <Slider
                      value={[custom.wind_speed_kts]}
                      onValueChange={(v) => updateCustomWeather({ wind_speed_kts: v[0] })}
                      min={0}
                      max={60}
                      step={1}
                    />
                  </div>

                  {/* Gusts */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gusts</span>
                      <span className="font-mono">
                        {custom.wind_gust_kts > 0 ? `+${custom.wind_gust_kts} kts` : 'None'}
                      </span>
                    </div>
                    <Slider
                      value={[custom.wind_gust_kts]}
                      onValueChange={(v) => updateCustomWeather({ wind_gust_kts: v[0] })}
                      min={0}
                      max={30}
                      step={1}
                    />
                  </div>
                </div>
              </section>

              {/* Cloud Layers */}
              <section className={cn(isReal && 'pointer-events-none opacity-40')}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cloud Layers
                    </span>
                  </div>
                  {custom.clouds.length < 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addCloudLayer}
                      className="h-6 gap-1 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3" /> Add Layer
                    </Button>
                  )}
                </div>
                {custom.clouds.length === 0 && (
                  <p className="text-sm text-muted-foreground">No cloud layers</p>
                )}
                <div className="space-y-3">
                  {custom.clouds.map((layer, i) => (
                    <CloudLayerCard
                      key={i}
                      index={i}
                      layer={layer}
                      onUpdate={(data) => updateCloudLayer(i, data)}
                      onRemove={() => removeCloudLayer(i)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* Right: Summary */}
            <div className="flex w-56 shrink-0 flex-col p-5">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Summary
              </h4>
              <div className="space-y-3 text-sm">
                <SummaryRow label="Visibility" value={formatVisibility(custom.visibility_km)} />
                <SummaryRow
                  label="Wind"
                  value={formatWind(
                    custom.wind_direction_deg,
                    custom.wind_speed_kts,
                    custom.wind_gust_kts
                  )}
                />
                <SummaryRow
                  label="Temperature"
                  value={`ISA ${custom.temperature_offset_c >= 0 ? '+' : ''}${custom.temperature_offset_c}\u00B0C`}
                />
                <SummaryRow
                  label="Precipitation"
                  value={
                    custom.precipitation === 0
                      ? 'None'
                      : `${Math.round(custom.precipitation * 100)}%`
                  }
                />
                <SummaryRow
                  label="Terrain"
                  value={
                    custom.terrain_state.charAt(0).toUpperCase() + custom.terrain_state.slice(1)
                  }
                />

                {custom.clouds.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <span className="text-xs font-medium text-muted-foreground">Clouds</span>
                    <div className="mt-1.5 space-y-1.5">
                      {custom.clouds.map((layer, i) => (
                        <div key={i} className="text-xs">
                          <div className="font-medium text-foreground">
                            {CLOUD_TYPE_LABELS[layer.type]} {Math.round(layer.cover * 100)}%
                          </div>
                          <div className="text-muted-foreground">
                            {layer.base_ft.toLocaleString()}&ndash;
                            {layer.tops_ft.toLocaleString()} ft
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isReal && (
                  <div className="rounded-md bg-primary/5 px-2.5 py-2 text-xs text-primary">
                    Using real-world weather data from X-Plane
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border bg-card px-4 py-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isReal}
              className="gap-1.5"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
            <Button onClick={onClose} size="sm">
              Done
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Cloud Layer Card ────────────────────────────────────────────────────────

function CloudLayerCard({
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
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Layer {index + 1}</span>
        <Button variant="ghost" size="icon" onClick={onRemove} className="h-5 w-5">
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-3">
        {/* Type */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Type</span>
          <Select
            value={layer.type}
            onValueChange={(v) => onUpdate({ type: v as CloudLayer['type'] })}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              {(Object.entries(CLOUD_TYPE_LABELS) as [CloudLayer['type'], string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Coverage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Coverage</span>
            <span className="font-mono">{Math.round(layer.cover * 100)}%</span>
          </div>
          <Slider
            value={[layer.cover * 100]}
            onValueChange={(v) => onUpdate({ cover: v[0] / 100 })}
            min={0}
            max={100}
            step={5}
          />
        </div>

        {/* Base */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Base</span>
            <span className="font-mono">{layer.base_ft.toLocaleString()} ft</span>
          </div>
          <Slider
            value={[layer.base_ft]}
            onValueChange={(v) => {
              const base = v[0];
              onUpdate({ base_ft: base, tops_ft: Math.max(layer.tops_ft, base + 500) });
            }}
            min={0}
            max={45000}
            step={500}
          />
        </div>

        {/* Tops */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tops</span>
            <span className="font-mono">{layer.tops_ft.toLocaleString()} ft</span>
          </div>
          <Slider
            value={[layer.tops_ft]}
            onValueChange={(v) => onUpdate({ tops_ft: Math.max(v[0], layer.base_ft + 500) })}
            min={500}
            max={60000}
            step={500}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Summary Row ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-foreground">{value}</span>
    </div>
  );
}
