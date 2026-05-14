import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/helpers';
import { useMapStore } from '@/stores/mapStore';
import type { SurfaceDetail } from '@/stores/settingsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { MapStylePicker } from './MapStylePicker';

const SURFACE_DETAIL_OPTIONS: { value: SurfaceDetail; labelKey: string }[] = [
  { value: 'low', labelKey: 'settings.graphics.low' },
  { value: 'medium', labelKey: 'settings.graphics.medium' },
  { value: 'high', labelKey: 'settings.graphics.high' },
];

export function GraphicsSection() {
  const { t } = useTranslation();
  const graphics = useSettingsStore((s) => s.graphics);
  const updateGraphics = useSettingsStore((s) => s.updateGraphicsSettings);

  // Map Style picker — moved here from Appearance so all map-render
  // settings live in one tab.
  const mapSettings = useSettingsStore((s) => s.map);
  const updateMapSettings = useSettingsStore((s) => s.updateMapSettings);
  const addUserMapStyle = useSettingsStore((s) => s.addUserMapStyle);
  const removeUserMapStyle = useSettingsStore((s) => s.removeUserMapStyle);

  // Terrain — runtime visibility flags live in mapStore so the map hooks
  // can subscribe directly. Settings UI just dispatches.
  const terrain3dEnabled = useMapStore((s) => s.terrain3dEnabled);
  const setTerrain3dEnabled = useMapStore((s) => s.setTerrain3dEnabled);
  const terrainShadingEnabled = useMapStore((s) => s.terrainShadingEnabled);
  const setTerrainShadingEnabled = useMapStore((s) => s.setTerrainShadingEnabled);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Monitor className="h-5 w-5" />
          {t('settings.graphics.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.graphics.description')}</p>
      </div>

      <Separator />

      {/* Map Style */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.graphics.mapStyle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.graphics.mapStyleDescription')}
          </p>
        </div>
        <MapStylePicker
          currentUrl={mapSettings.mapStyleUrl}
          userStyles={mapSettings.userMapStyles ?? []}
          onSelect={(url) => updateMapSettings({ mapStyleUrl: url })}
          onAdd={addUserMapStyle}
          onRemove={removeUserMapStyle}
        />
      </div>

      <Separator />

      {/* Terrain */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.graphics.terrain')}</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label className="text-sm font-medium">{t('settings.graphics.terrain3d')}</Label>
            <p className="text-xs text-muted-foreground">{t('settings.graphics.terrain3dDesc')}</p>
          </div>
          <Switch
            checked={terrain3dEnabled}
            onCheckedChange={(checked) => setTerrain3dEnabled(checked)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label className="text-sm font-medium">{t('settings.graphics.terrainShading')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.graphics.terrainShadingDesc')}
            </p>
          </div>
          <Switch
            checked={terrainShadingEnabled}
            onCheckedChange={(checked) => setTerrainShadingEnabled(checked)}
          />
        </div>
      </div>

      <Separator />

      {/* Surface Detail */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.graphics.surfaceDetail')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.graphics.surfaceDetailDesc')}
          </p>
        </div>
        <div className="flex gap-2">
          {SURFACE_DETAIL_OPTIONS.map(({ value, labelKey }) => (
            <Button
              key={value}
              variant={graphics.surfaceDetail === value ? 'default' : 'outline'}
              size="sm"
              className={cn('flex-1', graphics.surfaceDetail === value && 'pointer-events-none')}
              onClick={() => updateGraphics({ surfaceDetail: value })}
            >
              {t(labelKey)}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Lights */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.graphics.lights')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.graphics.lightsPerfHint')}
          </p>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label className="text-sm font-medium">{t('settings.graphics.approachLights')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.graphics.approachLightsDesc')}
            </p>
          </div>
          <Switch
            checked={graphics.approachLightAnimation}
            onCheckedChange={(checked) => updateGraphics({ approachLightAnimation: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label className="text-sm font-medium">{t('settings.graphics.taxiwayGlow')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.graphics.taxiwayGlowDesc')}
            </p>
          </div>
          <Switch
            checked={graphics.taxiwayLightGlow}
            onCheckedChange={(checked) => updateGraphics({ taxiwayLightGlow: checked })}
          />
        </div>
      </div>
    </div>
  );
}
