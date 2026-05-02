import { useTranslation } from 'react-i18next';
import { Map, Monitor, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Monitor className="h-5 w-5" />
          {t('settings.graphics.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.graphics.description')}</p>
      </div>

      <Separator />

      {/* Map Style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Map className="h-4 w-4" />
            {t('settings.appearance.mapStyle', 'Map Style')}
          </CardTitle>
          <CardDescription>
            {t('settings.appearance.mapStyleDescription', 'Select a map style for the background')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MapStylePicker
            currentUrl={mapSettings.mapStyleUrl}
            userStyles={mapSettings.userMapStyles ?? []}
            onSelect={(url) => updateMapSettings({ mapStyleUrl: url })}
            onAdd={addUserMapStyle}
            onRemove={removeUserMapStyle}
          />
        </CardContent>
      </Card>

      {/* Terrain */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Mountain className="h-4 w-4" />
            {t('settings.graphics.terrain', 'Terrain')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                {t('settings.graphics.terrain3d', '3D terrain')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.graphics.terrain3dDesc',
                  'Raise mountains and valleys when zoomed in. No effect on globe view.'
                )}
              </p>
            </div>
            <Switch
              checked={terrain3dEnabled}
              onCheckedChange={(checked) => setTerrain3dEnabled(checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                {t('settings.graphics.terrainShading', 'Hillshade & contours')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.graphics.terrainShadingDesc',
                  'Shaded relief and elevation contour lines.'
                )}
              </p>
            </div>
            <Switch
              checked={terrainShadingEnabled}
              onCheckedChange={(checked) => setTerrainShadingEnabled(checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Surface Detail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('settings.graphics.surfaceDetail', 'Surface detail')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.graphics.surfaceDetailDesc',
              'Curve smoothness for taxiway and pavement edges'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Lights */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Approach light animation */}
          <div className="flex items-center justify-between">
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

          <Separator />

          {/* Taxiway light glow */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                {t('settings.graphics.taxiwayGlow', 'Taxiway light glow')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.graphics.taxiwayGlowDesc',
                  'Multi-layer glow effect on taxiway lights'
                )}
              </p>
            </div>
            <Switch
              checked={graphics.taxiwayLightGlow}
              onCheckedChange={(checked) => updateGraphics({ taxiwayLightGlow: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
