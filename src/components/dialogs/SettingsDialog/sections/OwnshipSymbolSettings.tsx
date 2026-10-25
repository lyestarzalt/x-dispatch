import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAircraftShapeSvg } from '@/components/Map/layers/dynamic/aircraftIcons';
import {
  GENERIC_SHAPE,
  OWNSHIP_COLOR_SCHEMES,
  OWNSHIP_SIZES,
  OWNSHIP_SIZE_PX,
  type OwnshipColorScheme,
  type OwnshipIconImage,
  type OwnshipSize,
  createOwnshipIcon,
  createOwnshipShapeIcon,
  ownshipColors,
} from '@/components/Map/layers/dynamic/ownshipIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsSectionBlock, SettingsToggleRow } from '../primitives';

const SIZE_LABEL: Record<OwnshipSize, string> = {
  small: 'settings.appearance.ownshipSizeSmall',
  medium: 'settings.appearance.ownshipSizeMedium',
  large: 'settings.appearance.ownshipSizeLarge',
};

const COLOR_LABEL: Record<OwnshipColorScheme, string> = {
  white: 'settings.appearance.ownshipColorWhite',
  magenta: 'settings.appearance.ownshipColorMagenta',
  red: 'settings.appearance.ownshipColorRed',
};

/** The grounds the symbol has to read on: the dark vector basemap, satellite imagery, a light vector map. */
const BACKDROPS: { labelKey: string; background: string }[] = [
  { labelKey: 'settings.appearance.ownshipPreviewDark', background: '#0b1220' },
  {
    labelKey: 'settings.appearance.ownshipPreviewSatellite',
    background: 'linear-gradient(135deg, #7a6a48 0%, #9a8a5e 40%, #5a6b3f 100%)',
  },
  { labelKey: 'settings.appearance.ownshipPreviewLight', background: '#e5e7eb' },
];

/** The generic airplane silhouette, fetched once and rasterised per colour; null until it arrives. */
const shapeCache = new Map<OwnshipColorScheme, Promise<OwnshipIconImage | null>>();
function genericShapeIcon(scheme: OwnshipColorScheme): Promise<OwnshipIconImage | null> {
  let pending = shapeCache.get(scheme);
  if (!pending) {
    pending = fetchAircraftShapeSvg(GENERIC_SHAPE).then((svg) =>
      svg ? createOwnshipShapeIcon(svg, ownshipColors(scheme)) : null
    );
    shapeCache.set(scheme, pending);
  }
  return pending;
}

/** The symbol as the map draws it, scaled to `px`, with the data label beside it when asked. */
function SymbolCanvas({
  scheme,
  px,
  label,
}: {
  scheme: OwnshipColorScheme;
  px: number;
  label?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    const paint = (icon: OwnshipIconImage) => {
      const dpr = window.devicePixelRatio || 1;
      const w = label ? px + 84 : px;
      canvas.width = w * dpr;
      canvas.height = px * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${px}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const sprite = document.createElement('canvas');
      sprite.width = icon.width;
      sprite.height = icon.height;
      sprite
        .getContext('2d')
        ?.putImageData(
          new ImageData(new Uint8ClampedArray(icon.data), icon.width, icon.height),
          0,
          0
        );
      ctx.drawImage(sprite, 0, 0, px, px);

      if (label) {
        ctx.fillStyle = ownshipColors(scheme).accent;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 3;
        ctx.textBaseline = 'middle';
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText('N123AB', px + 8, px / 2 - 7);
        ctx.font = '500 10px system-ui, sans-serif';
        ctx.fillText('FL035  110 kt', px + 8, px / 2 + 7);
      }
    };

    // The placeholder first, the silhouette as soon as it is rasterised.
    paint(createOwnshipIcon('airplane', scheme));
    void genericShapeIcon(scheme).then((icon) => {
      if (!cancelled && icon) paint(icon);
    });
    return () => {
      cancelled = true;
    };
  }, [scheme, px, label]);
  return <canvas ref={ref} aria-hidden="true" />;
}

export function OwnshipSymbolSettings() {
  const { t } = useTranslation();
  const size = useSettingsStore((s) => s.graphics.ownshipSize);
  const color = useSettingsStore((s) => s.graphics.ownshipColor);
  const altitudeCues = useSettingsStore((s) => s.graphics.ownshipAltitudeCues);
  const updateGraphics = useSettingsStore((s) => s.updateGraphicsSettings);

  return (
    <SettingsSectionBlock
      title={t('settings.appearance.ownship')}
      description={t('settings.appearance.ownshipDesc')}
    >
      <div className="grid grid-cols-3 gap-2">
        {BACKDROPS.map(({ labelKey, background }) => (
          <div key={labelKey} className="space-y-1">
            <div
              className="flex h-20 items-center justify-center rounded-md"
              style={{ background }}
            >
              <SymbolCanvas scheme={color} px={OWNSHIP_SIZE_PX[size]} label />
            </div>
            <p className="text-muted-foreground text-center text-xs">{t(labelKey)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 pt-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('settings.appearance.ownshipSize')}</p>
          <p className="text-muted-foreground text-xs">
            {t('settings.appearance.ownshipSizeDesc')}
          </p>
        </div>
        <div className="bg-muted/50 flex shrink-0 gap-0.5 rounded-md p-0.5">
          {OWNSHIP_SIZES.map((option) => (
            <Button
              key={option}
              variant={size === option ? 'default' : 'ghost'}
              size="sm"
              className={cn('h-7 px-3 text-xs', size === option && 'pointer-events-none')}
              onClick={() => updateGraphics({ ownshipSize: option })}
            >
              {t(SIZE_LABEL[option])}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('settings.appearance.ownshipColor')}</p>
          <p className="text-muted-foreground text-xs">
            {t('settings.appearance.ownshipColorDesc')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {OWNSHIP_COLOR_SCHEMES.map((option) => {
            const { fill, edge } = ownshipColors(option);
            return (
              <button
                key={option}
                type="button"
                title={t(COLOR_LABEL[option])}
                aria-label={t(COLOR_LABEL[option])}
                aria-pressed={color === option}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform hover:scale-110',
                  'ring-offset-background focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none',
                  color === option ? 'ring-primary ring-2 ring-offset-2' : 'ring-0'
                )}
                onClick={() => updateGraphics({ ownshipColor: option })}
              >
                {/* The edge lives on the inner disc: the selection ring is a box-shadow on the button. */}
                <span
                  className="block h-full w-full rounded-full"
                  style={{ background: fill, boxShadow: `inset 0 0 0 3px ${edge}` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="pt-3">
        <SettingsToggleRow
          title={t('settings.appearance.ownshipAltitudeCues')}
          description={t('settings.appearance.ownshipAltitudeCuesDesc')}
          checked={altitudeCues}
          onCheckedChange={(ownshipAltitudeCues) => updateGraphics({ ownshipAltitudeCues })}
        />
      </div>
    </SettingsSectionBlock>
  );
}
