import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { changeLanguage, languages } from '@/i18n';
import type { WeightUnit } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import type { FontSize } from '@/stores/settingsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SettingsSectionProps } from '../types';

function ZoomSlider({
  zoomLevel,
  onCommit,
  resetLabel,
}: {
  zoomLevel: number;
  onCommit: (level: number) => void;
  resetLabel: string;
}) {
  const persisted = Math.round((zoomLevel || 1) * 100);
  const [preview, setPreview] = useState<number | null>(null);
  const display = preview ?? persisted;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">70%</span>
      <Slider
        value={[display]}
        onValueChange={(v) => {
          const val = v[0];
          if (val === undefined) return;
          setPreview(val);
        }}
        onValueCommit={(v) => {
          const val = v[0];
          if (val === undefined) return;
          setPreview(null);
          onCommit(val / 100);
        }}
        min={70}
        max={130}
        step={10}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground">130%</span>
      <span className="min-w-[4ch] text-center font-mono text-sm">{display}%</span>
      {persisted !== 100 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => onCommit(1.0)}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {resetLabel}
        </Button>
      )}
    </div>
  );
}

export default function AppearanceSection({ className }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const {
    map: mapSettings,
    updateMapSettings,
    appearance,
    setFontSize,
    setZoomLevel,
    setDebugOverlay,
  } = useSettingsStore();

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Palette className="h-5 w-5" />
          {t('settings.appearance.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.appearance.description')}</p>
      </div>

      <Separator />

      {/* Language */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.appearance.language')}</h3>
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Font Size */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.appearance.fontSize')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.appearance.fontSizeDescription')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <Button
              key={size}
              variant={appearance.fontSize === size ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontSize(size as FontSize)}
              className={
                appearance.fontSize === size
                  ? 'ring-1 ring-primary ring-offset-1 ring-offset-background'
                  : undefined
              }
            >
              {t(`settings.appearance.fontSize${size.charAt(0).toUpperCase() + size.slice(1)}`)}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Zoom Level */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.appearance.zoomLevel')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.appearance.zoomLevelDescription')}
          </p>
        </div>
        <ZoomSlider
          zoomLevel={appearance.zoomLevel}
          onCommit={setZoomLevel}
          resetLabel={t('settings.appearance.zoomReset')}
        />
      </div>

      <Separator />

      {/* Units */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.appearance.units')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.appearance.unitsDescription')}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('settings.appearance.weightUnit')}</Label>
          <Select
            value={mapSettings.units.weight}
            onValueChange={(value: WeightUnit) =>
              updateMapSettings({ units: { ...mapSettings.units, weight: value } })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lbs">{t('settings.appearance.lbs')}</SelectItem>
              <SelectItem value="kg">{t('settings.appearance.kg')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Developer Tools */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.about.tools')}</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('settings.about.debugOverlay')}</p>
            <p className="text-sm text-muted-foreground">
              {t('settings.about.debugOverlayDescription')}
            </p>
          </div>
          <Switch checked={appearance.debugOverlay} onCheckedChange={setDebugOverlay} />
        </div>
        <p className="text-xs text-muted-foreground">{t('settings.about.debugShortcut')}</p>
      </div>
    </div>
  );
}
