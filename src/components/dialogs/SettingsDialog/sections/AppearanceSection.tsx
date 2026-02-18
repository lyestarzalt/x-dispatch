import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Map, Palette, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { changeLanguage, languages } from '@/i18n';
import type { WeightUnit } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { MAP_STYLE_PRESETS, MapSettings, useSettingsStore } from '@/stores/settingsStore';
import type { SettingsSectionProps } from '../types';

export default function AppearanceSection({ className }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const { map: mapSettings, updateMapSettings } = useSettingsStore();

  const handleChange = useCallback(
    <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => {
      updateMapSettings({ [key]: value });
    },
    [updateMapSettings]
  );

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode);
  };

  const openFreeMapStyles = MAP_STYLE_PRESETS.filter((p) => p.provider === 'openfreemap');
  const cartoStyles = MAP_STYLE_PRESETS.filter((p) => p.provider === 'carto');

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

      {/* Map Style Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Map className="h-4 w-4" />
            {t('settings.appearance.mapStyle')}
          </CardTitle>
          <CardDescription>
            {t('settings.appearance.mapStyleDescription', 'Select a map style for the background')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OpenFreeMap */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">OpenFreeMap</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                {t('settings.appearance.unlimited')}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {openFreeMapStyles.map((preset) => (
                <Button
                  key={preset.id}
                  variant={mapSettings.mapStyleUrl === preset.url ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleChange('mapStyleUrl', preset.url)}
                  className={cn(
                    mapSettings.mapStyleUrl === preset.url &&
                      'ring-1 ring-primary ring-offset-1 ring-offset-background'
                  )}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* CARTO */}
          <div className="space-y-2">
            <span className="text-xs font-medium">CARTO</span>
            <div className="grid grid-cols-3 gap-2">
              {cartoStyles.map((preset) => (
                <Button
                  key={preset.id}
                  variant={mapSettings.mapStyleUrl === preset.url ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleChange('mapStyleUrl', preset.url)}
                  className={cn(
                    mapSettings.mapStyleUrl === preset.url &&
                      'ring-1 ring-primary ring-offset-1 ring-offset-background'
                  )}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom URL */}
          <div className="space-y-2">
            <Label className="text-xs">{t('settings.appearance.customStyleUrl')}</Label>
            <Input
              type="url"
              placeholder="https://example.com/style.json"
              value={mapSettings.mapStyleUrl}
              onChange={(e) => handleChange('mapStyleUrl', e.target.value)}
              className="h-9 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.appearance.customStyleHint')}
            </p>
          </div>
        </CardContent>
      </Card>

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
