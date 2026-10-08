import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Cloud, Droplets, Eye, Gauge, Thermometer, Waves } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUnits } from '@/hooks/useUnits';
import { cn } from '@/lib/utils/helpers';
import type { FeetPerMinute } from '@/lib/utils/units';
import type { EvolutionEnum, TerrainState } from '../../weatherTypes';
import {
  EVOLUTION_OPTIONS,
  ISA_SEA_LEVEL_TEMP_C,
  STD_ALTIMETER_HPA,
  VISIBILITY_STOPS,
  celsiusToFahrenheit,
  findClosestVisibilityIndex,
  formatVisibility,
  hpaToInHg,
  kmToSM,
} from '../../weatherTypes';
import { SectionHeader } from './SectionHeader';
import { UnitToggle } from './UnitToggle';

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

const TERRAIN_CONDITIONS: TerrainCondition[] = ['dry', 'wet', 'puddles', 'snow', 'ice', 'mix'];

const TERRAIN_INTENSITIES: TerrainIntensity[] = ['light', 'medium', 'heavy'];

// ─── Atmospheric Panel (Right) ──────────────────────────────────────────────

export function AtmosphericPanel({
  custom,
  isReal,
  onUpdate,
}: {
  custom: import('../../weatherTypes').CustomWeatherState;
  isReal: boolean;
  onUpdate: (partial: Partial<import('../../weatherTypes').CustomWeatherState>) => void;
}) {
  const { t } = useTranslation();
  const units = useUnits();
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
          <span className="text-muted-foreground flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {t('launcher.weatherDialog.visibility')}
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={visUnit}
              options={['km', 'SM']}
              onChange={(v) => setVisUnit(v as 'km' | 'SM')}
            />
            <span className="text-foreground w-20 text-right font-mono">{visDisplay}</span>
          </div>
        </div>
        <Slider
          value={[visibilityIndex]}
          onValueChange={(v) => {
            const idx = v[0];
            if (idx === undefined) return;
            const km = VISIBILITY_STOPS[idx];
            if (km === undefined) return;
            onUpdate({ visibility_km: km });
          }}
          min={0}
          max={VISIBILITY_STOPS.length - 1}
          step={1}
        />
      </div>

      {/* Precipitation */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            {t('launcher.weatherDialog.precipitation')}
          </span>
          <span className="text-foreground font-mono">
            {custom.precipitation === 0
              ? t('launcher.weatherDialog.precipNone')
              : custom.precipitation >= 0.8
                ? t('launcher.weatherDialog.precipSevere')
                : `${Math.round(custom.precipitation * 100)}%`}
          </span>
        </div>
        <Slider
          value={[custom.precipitation * 100]}
          onValueChange={(v) => {
            const val = v[0];
            if (val === undefined) return;
            onUpdate({ precipitation: val / 100 });
          }}
          min={0}
          max={100}
          step={5}
        />
      </div>

      {/* Temperature */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            {t('launcher.weatherDialog.temperature')}
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={tempUnit}
              options={['°C', '°F']}
              onChange={(v) => setTempUnit(v as '°C' | '°F')}
            />
            <span className="text-foreground w-14 text-right font-mono">{tempDisplay}</span>
          </div>
        </div>
        <Slider
          value={[custom.temperature_c]}
          onValueChange={(v) => onUpdate({ temperature_c: v[0] })}
          min={-50}
          max={58}
          step={1}
        />
        <span className="text-muted-foreground text-xs">
          ISA {custom.temperature_c >= ISA_SEA_LEVEL_TEMP_C ? '+' : ''}
          {custom.temperature_c - ISA_SEA_LEVEL_TEMP_C}&deg;C
        </span>
      </div>

      {/* Altimeter Setting */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            {t('launcher.weatherDialog.altimeter')}
          </span>
          <div className="flex items-center gap-1.5">
            <UnitToggle
              value={altUnit}
              options={['hPa', 'inHg']}
              onChange={(v) => setAltUnit(v as 'hPa' | 'inHg')}
            />
            <span className="text-foreground w-20 text-right font-mono">{altDisplay}</span>
          </div>
        </div>
        <Slider
          value={[custom.altimeter_hpa]}
          onValueChange={(v) => {
            const val = v[0];
            if (val === undefined) return;
            onUpdate({ altimeter_hpa: Math.round(val * 4) / 4 });
          }}
          min={940}
          max={1075}
          step={0.25}
        />
        <span className="text-muted-foreground text-xs">{altSubtext}</span>
      </div>

      {/* ── ENVIRONMENT ── */}
      <SectionHeader text={t('launcher.weatherDialog.environment')} />

      {/* Terrain — two-step cascading picker */}
      <div className="space-y-2.5">
        <span className="text-muted-foreground text-sm">{t('launcher.weatherDialog.terrain')}</span>

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
        <span className="text-muted-foreground flex items-center gap-2 text-sm">
          <Waves className="h-4 w-4" />
          {t('launcher.weatherDialog.waves')}
        </span>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('launcher.weatherDialog.waveHeight')}</span>
            <span className="text-foreground font-mono">{custom.wave_height_m.toFixed(1)} m</span>
          </div>
          <Slider
            value={[custom.wave_height_m]}
            onValueChange={(v) => {
              const val = v[0];
              if (val === undefined) return;
              onUpdate({ wave_height_m: Math.round(val * 10) / 10 });
            }}
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
            <span className="text-foreground font-mono">
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
          <span className="text-muted-foreground flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            {t('launcher.weatherDialog.thermals')}
          </span>
          <span className="text-foreground font-mono">
            {custom.thermal_fpm === 0
              ? t('launcher.weatherDialog.thermalsNone')
              : units.verticalSpeed(custom.thermal_fpm as FeetPerMinute)}
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
          <span className="text-muted-foreground flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            {t('launcher.weatherDialog.variation')}
          </span>
          <span className="text-foreground font-mono">{Math.round(custom.variation_pct)}%</span>
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
        <span className="text-muted-foreground text-sm">
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
