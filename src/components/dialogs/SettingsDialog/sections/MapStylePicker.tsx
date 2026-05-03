import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { MapStyleUrlError } from '@/lib/map/tileUrlToStyle';
import { validateMapStyleUrl } from '@/lib/map/tileUrlToStyle';
import { cn } from '@/lib/utils/helpers';
import type { MapStyle } from '@/stores/settingsStore';
import { MAP_STYLE_PRESETS } from '@/stores/settingsStore';

/**
 * Derive a short, human-readable label for a user-added map style URL.
 * Strips known subdomains so "tiles.maptiler.com" becomes "MapTiler",
 * falls back to the bare hostname otherwise. Caller passes the localised
 * fallback so this stays string-free.
 */
function deriveStyleNameFromUrl(url: string, fallback: string): string {
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
    return fallback;
  }
}

export function MapStylePicker({
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
  const [errorCode, setErrorCode] = useState<MapStyleUrlError | 'duplicate' | null>(null);

  const allUrls = useMemo(
    () =>
      new Set<string>([...MAP_STYLE_PRESETS.map((p) => p.url), ...userStyles.map((s) => s.url)]),
    [userStyles]
  );

  const handleAdd = () => {
    const url = draft.trim();
    const validation = validateMapStyleUrl(url);
    if (validation) {
      setErrorCode(validation);
      return;
    }
    if (allUrls.has(url)) {
      setErrorCode('duplicate');
      return;
    }
    const style: MapStyle = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `user-${crypto.randomUUID()}`
          : `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: deriveStyleNameFromUrl(url, t('settings.graphics.customStyleFallbackName')),
      url,
    };
    onAdd(style);
    onSelect(url); // apply right away so the user sees the new style
    setDraft('');
    setErrorCode(null);
  };

  const errorMessage = errorCode
    ? t(`settings.graphics.mapStyleError.${errorCode}`, {
        placeholder: '{z}/{x}/{y}',
      })
    : null;

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
        <Label className="text-sm">{t('settings.graphics.customStyleUrl')}</Label>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com/style.json"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (errorCode) setErrorCode(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="h-9 font-mono text-sm"
            aria-invalid={!!errorCode}
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
            {t('settings.graphics.customStyleAdd')}
          </Button>
        </div>
        {errorMessage ? (
          <p className="text-xs text-destructive">{errorMessage}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('settings.graphics.customStyleHint', { placeholder: '{z}/{x}/{y}' })}
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
  const { t } = useTranslation();
  // X to remove is a sibling of the Button (not nested) — nested <button>
  // is invalid HTML and confuses screen readers.
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
          aria-label={t('settings.graphics.customStyleRemove', { name: label })}
          className={cn(
            'absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 transition hover:bg-muted hover:text-foreground',
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
