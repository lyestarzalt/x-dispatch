import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import { useMapStore } from '@/stores/mapStore';
import type { SurfaceDetail } from '@/stores/settingsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsSectionBlock, SettingsToggleRow } from '../primitives';
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
      <SettingsHeader
        icon={Monitor}
        title={t('settings.graphics.title')}
        description={t('settings.graphics.description')}
      />

      {/* Map Style */}
      <SettingsSectionBlock
        title={t('settings.graphics.mapStyle')}
        description={t('settings.graphics.mapStyleDescription')}
      >
        <MapStylePicker
          currentUrl={mapSettings.mapStyleUrl}
          userStyles={mapSettings.userMapStyles ?? []}
          onSelect={(url) => updateMapSettings({ mapStyleUrl: url })}
          onAdd={addUserMapStyle}
          onRemove={removeUserMapStyle}
        />
      </SettingsSectionBlock>

      <Separator />

      {/* Terrain */}
      <SettingsSectionBlock title={t('settings.graphics.terrain')}>
        <SettingsToggleRow
          title={t('settings.graphics.terrain3d')}
          description={t('settings.graphics.terrain3dDesc')}
          checked={terrain3dEnabled}
          onCheckedChange={(checked) => setTerrain3dEnabled(checked)}
        />
        <SettingsToggleRow
          title={t('settings.graphics.terrainShading')}
          description={t('settings.graphics.terrainShadingDesc')}
          checked={terrainShadingEnabled}
          onCheckedChange={(checked) => setTerrainShadingEnabled(checked)}
        />
      </SettingsSectionBlock>

      <Separator />

      {/* Surface Detail */}
      <SettingsSectionBlock
        title={t('settings.graphics.surfaceDetail')}
        description={t('settings.graphics.surfaceDetailDesc')}
      >
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
      </SettingsSectionBlock>

      <Separator />

      {/* Lights */}
      <SettingsSectionBlock
        title={t('settings.graphics.lights')}
        description={t('settings.graphics.lightsPerfHint')}
      >
        <SettingsToggleRow
          title={t('settings.graphics.approachLights')}
          description={t('settings.graphics.approachLightsDesc')}
          checked={graphics.approachLightAnimation}
          onCheckedChange={(checked) => updateGraphics({ approachLightAnimation: checked })}
        />
        <SettingsToggleRow
          title={t('settings.graphics.taxiwayGlow')}
          description={t('settings.graphics.taxiwayGlowDesc')}
          checked={graphics.taxiwayLightGlow}
          onCheckedChange={(checked) => updateGraphics({ taxiwayLightGlow: checked })}
        />
      </SettingsSectionBlock>
    </div>
  );
}
