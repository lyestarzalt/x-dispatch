import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { airSpeedFromMs, airSpeedToMs, isValidAirStartSpeed } from '@/lib/utils/airStartSpeed';
import type { StartPosition } from '@/types/position';

export function AirStartSpeedInput({
  position,
  onChange,
}: {
  position: StartPosition;
  onChange: (fields: Partial<StartPosition>) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const unit = position.airSpeedUnit ?? 'kt';
  const valid = isValidAirStartSpeed(position.airSpeedMs);
  const display = valid ? String(Math.round(airSpeedFromMs(position.airSpeedMs!, unit))) : '';

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t('toolbar.pinModes.speed')}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={t('toolbar.pinModes.speedCustom')}
          value={editing ? draft : display}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${id}-error` : undefined}
          onFocus={() => {
            setDraft(display);
            setEditing(true);
          }}
          onChange={(event) => {
            const value = event.target.value;
            if (!/^\d*$/.test(value)) return;
            setDraft(value);
            const speed = Number(value);
            onChange({
              airSpeedMs:
                Number.isSafeInteger(speed) && isValidAirStartSpeed(speed)
                  ? airSpeedToMs(speed, unit)
                  : undefined,
              airSpeedEnum: undefined,
            });
          }}
          onBlur={() => setEditing(false)}
          className="h-8 min-w-0 font-mono text-sm"
        />
        <ToggleGroup
          type="single"
          value={unit}
          onValueChange={(value) => {
            if (value === 'kt' || value === 'ms') onChange({ airSpeedUnit: value });
          }}
          aria-label={t('toolbar.pinModes.speedUnit')}
          className="shrink-0"
        >
          <ToggleGroupItem value="kt" className="h-8 px-2">
            {t('units.kt')}
          </ToggleGroupItem>
          <ToggleGroupItem value="ms" className="h-8 px-2">
            {t('units.ms')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {!valid && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {t('toolbar.pinModes.speedRequired')}
        </p>
      )}
    </div>
  );
}
