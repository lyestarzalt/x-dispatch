import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Palette, RotateCcw, Scale, Type, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <CardContent>
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
    </CardContent>
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

      {/* Language Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" />
            {t('settings.appearance.language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4" />
            {t('settings.appearance.fontSize')}
          </CardTitle>
          <CardDescription>{t('settings.appearance.fontSizeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <Button
                key={size}
                variant={appearance.fontSize === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFontSize(size as FontSize)}
                className={cn(
                  appearance.fontSize === size &&
                    'ring-1 ring-primary ring-offset-1 ring-offset-background'
                )}
              >
                {t(`settings.appearance.fontSize${size.charAt(0).toUpperCase() + size.slice(1)}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Zoom Level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ZoomIn className="h-4 w-4" />
            {t('settings.appearance.zoomLevel')}
          </CardTitle>
          <CardDescription>{t('settings.appearance.zoomLevelDescription')}</CardDescription>
        </CardHeader>
        <ZoomSlider
          zoomLevel={appearance.zoomLevel}
          onCommit={setZoomLevel}
          resetLabel={t('settings.appearance.zoomReset')}
        />
      </Card>

      {/* Units */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Scale className="h-4 w-4" />
            {t('settings.appearance.units')}
          </CardTitle>
          <CardDescription>{t('settings.appearance.unitsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
