import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Map, Palette, Plus, RotateCcw, Scale, Type, X, ZoomIn } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
// Switch removed — idle orbit toggle moved to Graphics tab
import { changeLanguage, languages } from '@/i18n';
import { validateMapStyleUrl } from '@/lib/map/tileUrlToStyle';
import type { WeightUnit } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import type { FontSize, MapStyle } from '@/stores/settingsStore';
import { MAP_STYLE_PRESETS, MapSettings, useSettingsStore } from '@/stores/settingsStore';
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

// ---------------------------------------------------------------------------
// Map style picker
// ---------------------------------------------------------------------------

/**
 * Derive a short, human-readable label for a user-added map style URL.
 * Strips known subdomains so "tiles.maptiler.com" becomes "MapTiler",
 * falls back to the bare hostname otherwise.
 */
function deriveStyleNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    const parts = host.split('.').filter(Boolean);
    // drop a leading "tiles" / "tile" / "basemaps" / "server" subdomain
    if (parts.length > 2 && /^(tile|tiles|basemaps|server)$/.test(parts[0] ?? '')) {
      parts.shift();
    }
    const label = parts[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Custom';
  }
}

function MapStylePicker({
  currentUrl,
  userStyles,
  onSelect,
  onAdd,
  onRemove,
}: {
  currentUrl: string;
  userStyles: MapStyle[];
  onSelect: (url: string) => void;
  onAdd: (style: MapStyle) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allUrls = useMemo(
    () =>
      new Set<string>([...MAP_STYLE_PRESETS.map((p) => p.url), ...userStyles.map((s) => s.url)]),
    [userStyles]
  );

  const handleAdd = () => {
    const url = draft.trim();
    const message = validateMapStyleUrl(url);
    if (message) {
      setError(message);
      return;
    }
    if (allUrls.has(url)) {
      setError('Already in your list');
      return;
    }
    const style: MapStyle = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `user-${crypto.randomUUID()}`
          : `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: deriveStyleNameFromUrl(url),
      url,
    };
    onAdd(style);
    onSelect(url); // apply right away so the user sees the new style
    setDraft('');
    setError(null);
  };

  return (
    <div className="space-y-3">
      {/* Unified grid: presets + user styles, all rendered as the same Button.
          User styles get a corner X to delete. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MAP_STYLE_PRESETS.map((preset) => (
          <StyleButton
            key={preset.id}
            label={preset.name}
            active={currentUrl === preset.url}
            onSelect={() => onSelect(preset.url)}
          />
        ))}
        {userStyles.map((style) => (
          <StyleButton
            key={style.id}
            label={style.name}
            url={style.url}
            active={currentUrl === style.url}
            onSelect={() => onSelect(style.url)}
            onRemove={() => onRemove(style.id)}
          />
        ))}
      </div>

      <Separator />

      {/* Add custom URL — draft input that doesn't apply until "Add" is clicked. */}
      <div className="space-y-2">
        <Label className="text-sm">{t('settings.appearance.customStyleUrl')}</Label>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com/style.json"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="h-9 font-mono text-sm"
            aria-invalid={!!error}
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="h-9 shrink-0"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Paste a MapLibre style.json URL, or a raster tile pattern with{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">{'{z}/{x}/{y}'}</code>.
          </p>
        )}
      </div>
    </div>
  );
}

function StyleButton({
  label,
  url,
  active,
  onSelect,
  onRemove,
}: {
  label: string;
  url?: string;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  // The X to remove is rendered as a *sibling* of the Button rather than a
  // child, to avoid the nested-<button> DOM (which is invalid HTML and
  // confuses screen readers). The wrapper has `position: relative` so the X
  // can be positioned over the right edge of the Button. The X has a higher
  // z-index so its click target wins; we still stopPropagation as belt-and-
  // suspenders in case the layouts shift.
  return (
    <div className="relative">
      <Button
        variant={active ? 'default' : 'outline'}
        size="sm"
        onClick={onSelect}
        title={url}
        className={cn(
          'w-full',
          active && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
          // Reserve space on the right so long names don't clip the X icon.
          onRemove && 'pr-7'
        )}
      >
        <span className="truncate">{label}</span>
      </Button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${label}`}
          className={cn(
            'absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 transition hover:bg-muted hover:text-foreground',
            // Keep good contrast against the active (primary-bg) variant too.
            active
              ? 'text-primary-foreground/70 opacity-80 hover:opacity-100'
              : 'text-muted-foreground opacity-60 hover:opacity-100'
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default function AppearanceSection({ className }: SettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const {
    map: mapSettings,
    updateMapSettings,
    addUserMapStyle,
    removeUserMapStyle,
    appearance,
    setFontSize,
    setZoomLevel,
  } = useSettingsStore();

  const handleChange = useCallback(
    <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => {
      updateMapSettings({ [key]: value });
    },
    [updateMapSettings]
  );

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
          <MapStylePicker
            currentUrl={mapSettings.mapStyleUrl}
            userStyles={mapSettings.userMapStyles ?? []}
            onSelect={(url) => handleChange('mapStyleUrl', url)}
            onAdd={addUserMapStyle}
            onRemove={removeUserMapStyle}
          />
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
