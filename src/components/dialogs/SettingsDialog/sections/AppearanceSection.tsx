import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { changeLanguage, languages } from '@/i18n';
import { cn } from '@/lib/utils/helpers';
import type { FontSize } from '@/stores/settingsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsSectionBlock, SettingsToggleRow } from '../primitives';
import type { SettingsSectionProps } from '../types';

const FONT_SIZES = ['small', 'medium', 'large'] as const;

function ZoomSlider({
  zoomLevel,
  onCommit,
  resetLabel,
  min = 70,
  max = 130,
  step = 10,
}: {
  zoomLevel: number;
  onCommit: (level: number) => void;
  resetLabel: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const persisted = Math.round((zoomLevel || 1) * 100);
  const [preview, setPreview] = useState<number | null>(null);
  const display = preview ?? persisted;

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground text-xs">{min}%</span>
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
        min={min}
        max={max}
        step={step}
        className="flex-1"
      />
      <span className="text-muted-foreground text-xs">{max}%</span>
      <span className="min-w-[4ch] text-center font-mono text-sm">{display}%</span>
      {persisted !== 100 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 text-xs"
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
  const { appearance, setFontSize, setZoomLevel, setFlightStripScale, setDebugOverlay } =
    useSettingsStore();

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Palette}
        title={t('settings.appearance.title')}
        description={t('settings.appearance.description')}
      />

      {/* Language */}
      <SettingsSectionBlock title={t('settings.appearance.language')}>
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
      </SettingsSectionBlock>

      {/* Font Size */}
      <SettingsSectionBlock
        title={t('settings.appearance.fontSize')}
        description={t('settings.appearance.fontSizeDescription')}
      >
        <div className="grid grid-cols-3 gap-2">
          {FONT_SIZES.map((size) => (
            <Button
              key={size}
              variant={appearance.fontSize === size ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontSize(size as FontSize)}
              className={
                appearance.fontSize === size
                  ? 'ring-primary ring-offset-background ring-1 ring-offset-1'
                  : undefined
              }
            >
              {t(`settings.appearance.fontSize${size.charAt(0).toUpperCase() + size.slice(1)}`)}
            </Button>
          ))}
        </div>
      </SettingsSectionBlock>

      {/* Zoom Level */}
      <SettingsSectionBlock
        title={t('settings.appearance.zoomLevel')}
        description={t('settings.appearance.zoomLevelDescription')}
      >
        <ZoomSlider
          zoomLevel={appearance.zoomLevel}
          onCommit={setZoomLevel}
          resetLabel={t('settings.appearance.zoomReset')}
        />
      </SettingsSectionBlock>

      {/* Flight strip size */}
      <SettingsSectionBlock
        title={t('settings.appearance.flightStripScale')}
        description={t('settings.appearance.flightStripScaleDescription')}
      >
        <ZoomSlider
          zoomLevel={appearance.flightStripScale}
          onCommit={setFlightStripScale}
          resetLabel={t('settings.appearance.zoomReset')}
          min={100}
          max={200}
          step={10}
        />
      </SettingsSectionBlock>

      {/* Developer Tools */}
      <SettingsSectionBlock title={t('settings.about.tools')}>
        <SettingsToggleRow
          title={t('settings.about.debugOverlay')}
          description={t('settings.about.debugOverlayDescription')}
          checked={appearance.debugOverlay}
          onCheckedChange={setDebugOverlay}
        />
        <p className="text-muted-foreground text-xs">{t('settings.about.debugShortcut')}</p>
      </SettingsSectionBlock>
    </div>
  );
}
