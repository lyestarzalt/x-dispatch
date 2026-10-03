import { useTranslation } from 'react-i18next';
import { Ruler } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsChoiceRow, SettingsHeader, SettingsSectionBlock } from '../primitives';
import type { SettingsSectionProps } from '../types';
import { type UnitExampleKinds, unitExample } from './unitExamples';

type UnitKind = keyof UnitExampleKinds;

interface UnitRowSpec<K extends UnitKind = UnitKind> {
  kind: K;
  options: ReadonlyArray<{ value: UnitExampleKinds[K]; labelKey: string }>;
  /** Long descriptive labels get their own full-width row under the title. */
  layout?: 'inline' | 'stacked';
}

const spec = <K extends UnitKind>(
  kind: K,
  options: ReadonlyArray<{ value: UnitExampleKinds[K]; labelKey: string }>,
  layout: 'inline' | 'stacked' = 'inline'
): UnitRowSpec<K> => ({ kind, options, layout });

const MEASUREMENT_ROWS = [
  spec('distance', [
    { value: 'nm', labelKey: 'units.nm' },
    { value: 'km', labelKey: 'units.km' },
    { value: 'mi', labelKey: 'units.mi' },
  ]),
  spec('altitude', [
    { value: 'ft', labelKey: 'units.ft' },
    { value: 'm', labelKey: 'units.m' },
  ]),
  spec('speed', [
    { value: 'kts', labelKey: 'units.kts' },
    { value: 'kmh', labelKey: 'units.kmh' },
    { value: 'mph', labelKey: 'units.mph' },
  ]),
  spec('verticalSpeed', [
    { value: 'fpm', labelKey: 'units.fpm' },
    { value: 'ms', labelKey: 'units.ms' },
  ]),
  spec('weight', [
    { value: 'lbs', labelKey: 'units.lbs' },
    { value: 'kg', labelKey: 'units.kg' },
  ]),
] as const;

const NAVIGATION_ROWS = [
  spec(
    'coordinates',
    [
      { value: 'decimal', labelKey: 'settings.units.coordinateFormats.decimal' },
      { value: 'dms', labelKey: 'settings.units.coordinateFormats.dms' },
      { value: 'dm', labelKey: 'settings.units.coordinateFormats.dm' },
    ],
    'stacked'
  ),
  spec('course', [
    { value: 'magnetic', labelKey: 'settings.units.courseModes.magnetic' },
    { value: 'true', labelKey: 'settings.units.courseModes.true' },
    { value: 'both', labelKey: 'settings.units.courseModes.both' },
  ]),
] as const;

export default function UnitsSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { map: mapSettings, updateMapSettings } = useSettingsStore();
  const units = mapSettings.units;

  /** One row per quantity: the title, the sample in the current unit, and the unit choice. */
  const renderRow = ({ kind, options, layout }: UnitRowSpec) => (
    <SettingsChoiceRow
      key={kind}
      title={t(`settings.units.${kind}`)}
      description={<span className="font-mono">{unitExample(kind, units[kind], t)}</span>}
      value={units[kind]}
      options={options.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
      onChange={(value) => updateMapSettings({ units: { ...units, [kind]: value } })}
      layout={layout}
    />
  );

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Ruler}
        title={t('settings.units.title')}
        description={t('settings.units.description')}
      />

      <SettingsSectionBlock title={t('settings.units.measurements')}>
        {MEASUREMENT_ROWS.map(renderRow)}
      </SettingsSectionBlock>

      <Separator />

      <SettingsSectionBlock title={t('settings.units.navigation')}>
        {NAVIGATION_ROWS.map(renderRow)}
      </SettingsSectionBlock>
    </div>
  );
}
