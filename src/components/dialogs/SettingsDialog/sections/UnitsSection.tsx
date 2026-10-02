import { useTranslation } from 'react-i18next';
import { Ruler } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils/helpers';
import type {
  AltitudeUnit,
  CoordinateFormat,
  DistanceUnit,
  SpeedUnit,
  VerticalSpeedUnit,
} from '@/lib/utils/units';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsSectionBlock } from '../primitives';
import type { SettingsSectionProps } from '../types';

/** One segmented-pill row: label on the left, a single-select ToggleGroup of unit options on the right. */
function UnitPickerRow<TValue extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: TValue;
  options: ReadonlyArray<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <SettingsSectionBlock title={title}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          // Radix's single ToggleGroup emits '' when clicking the already-active
          // item (it tries to deselect) — ignore that, one option must stay selected.
          if (next) onChange(next as TValue);
        }}
        className="justify-start"
      >
        {options.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value}>
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsSectionBlock>
  );
}

export default function UnitsSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { map: mapSettings, updateMapSettings } = useSettingsStore();
  const units = mapSettings.units;

  const update = (patch: Partial<typeof units>) =>
    updateMapSettings({ units: { ...units, ...patch } });

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Ruler}
        title={t('settings.units.title')}
        description={t('settings.units.description')}
      />

      <UnitPickerRow<DistanceUnit>
        title={t('settings.units.distance')}
        value={units.distance}
        onChange={(distance) => update({ distance })}
        options={[
          { value: 'nm', label: t('units.nm') },
          { value: 'km', label: t('units.km') },
          { value: 'mi', label: t('units.mi') },
        ]}
      />

      <UnitPickerRow<AltitudeUnit>
        title={t('settings.units.altitude')}
        value={units.altitude}
        onChange={(altitude) => update({ altitude })}
        options={[
          { value: 'ft', label: t('units.ft') },
          { value: 'm', label: t('units.m') },
        ]}
      />

      <UnitPickerRow<SpeedUnit>
        title={t('settings.units.speed')}
        value={units.speed}
        onChange={(speed) => update({ speed })}
        options={[
          { value: 'kts', label: t('units.kts') },
          { value: 'kmh', label: t('units.kmh') },
          { value: 'mph', label: t('units.mph') },
        ]}
      />

      <UnitPickerRow<VerticalSpeedUnit>
        title={t('settings.units.verticalSpeed')}
        value={units.verticalSpeed}
        onChange={(verticalSpeed) => update({ verticalSpeed })}
        options={[
          { value: 'fpm', label: t('units.fpm') },
          { value: 'ms', label: t('units.ms') },
        ]}
      />

      <UnitPickerRow<'lbs' | 'kg'>
        title={t('settings.units.weight')}
        value={units.weight}
        onChange={(weight) => update({ weight })}
        options={[
          { value: 'lbs', label: t('units.lbs') },
          { value: 'kg', label: t('units.kg') },
        ]}
      />

      <UnitPickerRow<CoordinateFormat>
        title={t('settings.units.coordinates')}
        value={units.coordinates}
        onChange={(coordinates) => update({ coordinates })}
        options={[
          { value: 'decimal', label: t('settings.units.coordinateFormats.decimal') },
          { value: 'dms', label: t('settings.units.coordinateFormats.dms') },
          { value: 'dm', label: t('settings.units.coordinateFormats.dm') },
        ]}
      />
    </div>
  );
}
