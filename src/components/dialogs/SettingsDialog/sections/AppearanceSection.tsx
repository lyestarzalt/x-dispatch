import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, RotateCcw } from 'lucide-react';
import {
  NETWORK_TRAFFIC_COLOR_CHOICES,
  type NetworkTrafficColorChoice,
} from '@/components/Map/layers/dynamic/NetworkTrafficLayer';
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
import { ZOOM_LEVEL_RANGE, useSettingsStore } from '@/stores/settingsStore';
import {
  SettingsChoiceRow,
  SettingsHeader,
  SettingsSectionBlock,
  SettingsToggleRow,
} from '../primitives';
import type { SettingsSectionProps } from '../types';
import { OwnshipSymbolSettings } from './OwnshipSymbolSettings';

const FONT_SIZES = ['small', 'medium', 'large'] as const;

const TRAFFIC_COLOR_LABEL: Record<NetworkTrafficColorChoice, string> = {
  network: 'settings.appearance.networkTrafficColorNetwork',
  green: 'settings.appearance.networkTrafficColorGreen',
  blue: 'settings.appearance.networkTrafficColorBlue',
};

const isLinux = window.appAPI?.platform === 'linux';
const isMac = window.appAPI?.platform === 'darwin';

/** The slider works in percent of the Interface Zoom range. */
const ZOOM_MIN = Math.round(ZOOM_LEVEL_RANGE.min * 100);
const ZOOM_MAX = Math.round(ZOOM_LEVEL_RANGE.max * 100);
const ZOOM_STEP = Math.round(ZOOM_LEVEL_RANGE.step * 100);

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
      <span className="text-muted-foreground text-xs">{ZOOM_MIN}%</span>
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
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={ZOOM_STEP}
        className="flex-1"
      />
      <span className="text-muted-foreground text-xs">{ZOOM_MAX}%</span>
      <span className="min-w-[4.5ch] text-center font-mono text-sm">{display}%</span>
      {persisted !== 100 && (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => onCommit(1.0)}
        >
          <RotateCcw className="h-3 w-3" />
          {resetLabel}
        </Button>
      )}
    </div>
  );
}

export default function AppearanceSection({ className }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const { appearance, setFontSize, setZoomLevel, setDebugOverlay, desktop, updateDesktopSettings } =
    useSettingsStore();
  const networkTrafficColor = useSettingsStore((s) => s.graphics.networkTrafficColor);
  const updateGraphics = useSettingsStore((s) => s.updateGraphicsSettings);

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

      <OwnshipSymbolSettings />

      {/* VATSIM and IVAO pilots on the map */}
      <SettingsSectionBlock title={t('settings.appearance.networkTraffic')}>
        <SettingsChoiceRow
          title={t('settings.appearance.networkTrafficColor')}
          description={t('settings.appearance.networkTrafficColorDesc')}
          value={networkTrafficColor}
          options={NETWORK_TRAFFIC_COLOR_CHOICES.map((choice) => ({
            value: choice,
            label: t(TRAFFIC_COLOR_LABEL[choice]),
          }))}
          onChange={(choice) => updateGraphics({ networkTrafficColor: choice })}
        />
      </SettingsSectionBlock>

      {/* Desktop window behaviour; main applies these */}
      <SettingsSectionBlock
        title={t('settings.appearance.desktop')}
        description={t('settings.appearance.desktopDescription')}
      >
        <div className="space-y-3">
          {isMac && (
            <SettingsToggleRow
              title={t('settings.appearance.keepRunningOnClose')}
              description={t('settings.appearance.keepRunningOnCloseDescription')}
              checked={desktop.keepRunningOnClose}
              onCheckedChange={(keepRunningOnClose) =>
                updateDesktopSettings({ keepRunningOnClose })
              }
            />
          )}
          <SettingsToggleRow
            title={t('settings.appearance.attention')}
            description={t('settings.appearance.attentionDescription')}
            checked={desktop.attention}
            onCheckedChange={(attention) => updateDesktopSettings({ attention })}
          />
          {!isLinux && (
            <SettingsToggleRow
              title={t('settings.appearance.recentAirportsMenu')}
              description={t(
                isMac
                  ? 'settings.appearance.recentAirportsMenuDescriptionMac'
                  : 'settings.appearance.recentAirportsMenuDescriptionWindows'
              )}
              checked={desktop.recentAirportsMenu}
              onCheckedChange={(recentAirportsMenu) =>
                updateDesktopSettings({ recentAirportsMenu })
              }
            />
          )}
        </div>
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
