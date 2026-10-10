import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AirfieldLightsMode } from '@/lib/airportLights/lightFactor';
import {
  DEFAULT_REFERENCE_LABEL_SETTINGS,
  REFERENCE_LABEL_CATEGORIES,
  type ReferenceLabelSettings,
} from '@/lib/map/referenceLabelSettings';
import { terrainShadingAllowed } from '@/lib/map/terrainShading';
import { isRasterTileUrl } from '@/lib/map/tileUrlToStyle';
import { cn } from '@/lib/utils/helpers';
import { useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  SettingsHeader,
  SettingsSectionBlock,
  SettingsSliderRow,
  SettingsToggleRow,
} from '../primitives';
import { MapStylePicker } from './MapStylePicker';

const AIRFIELD_LIGHT_OPTIONS: { value: AirfieldLightsMode; labelKey: string }[] = [
  { value: 'auto', labelKey: 'settings.graphics.airfieldLightsAuto' },
  { value: 'on', labelKey: 'settings.graphics.airfieldLightsOn' },
  { value: 'off', labelKey: 'settings.graphics.airfieldLightsOff' },
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
  // Off and locked on an imagery basemap; the stored preference returns with a vector style.
  const mapStyleUrl = useSettingsStore((s) => s.map.mapStyleUrl);
  const shadingAllowed = terrainShadingAllowed(mapStyleUrl);

  const labelsUsed = isRasterTileUrl(mapStyleUrl);
  const labels = mapSettings.referenceLabels ?? DEFAULT_REFERENCE_LABEL_SETTINGS;
  const updateLabels = (patch: Partial<ReferenceLabelSettings>) =>
    updateMapSettings({ referenceLabels: { ...labels, ...patch } });

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

      {/* Labels over image basemaps; vector styles bring their own */}
      {labelsUsed && (
        <SettingsSectionBlock
          title={t('settings.graphics.mapLabels')}
          description={t('settings.graphics.mapLabelsDesc')}
        >
          <div className="flex flex-wrap gap-2">
            {REFERENCE_LABEL_CATEGORIES.map((category) => {
              const on = labels.show[category];
              return (
                <Button
                  key={category}
                  variant={on ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={on}
                  onClick={() => updateLabels({ show: { ...labels.show, [category]: !on } })}
                >
                  {t(`settings.graphics.labelCategory.${category}`)}
                </Button>
              );
            })}
          </div>
          <SettingsSliderRow
            title={t('settings.graphics.labelBrightness')}
            value={Math.round(labels.brightness * 100)}
            defaultValue={Math.round(DEFAULT_REFERENCE_LABEL_SETTINGS.brightness * 100)}
            min={50}
            max={100}
            step={5}
            onCommit={(percent) => updateLabels({ brightness: percent / 100 })}
            resetLabel={t('settings.appearance.zoomReset')}
          />
          <SettingsSliderRow
            title={t('settings.graphics.labelSize')}
            value={Math.round(labels.sizeScale * 100)}
            defaultValue={Math.round(DEFAULT_REFERENCE_LABEL_SETTINGS.sizeScale * 100)}
            min={80}
            max={160}
            step={10}
            onCommit={(percent) => updateLabels({ sizeScale: percent / 100 })}
            resetLabel={t('settings.appearance.zoomReset')}
          />
        </SettingsSectionBlock>
      )}

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
          description={
            shadingAllowed
              ? t('settings.graphics.terrainShadingDesc')
              : t('settings.graphics.terrainShadingSatellite')
          }
          checked={terrainShadingEnabled && shadingAllowed}
          disabled={!shadingAllowed}
          onCheckedChange={(checked) => setTerrainShadingEnabled(checked)}
        />
      </SettingsSectionBlock>

      {/* Sky and night */}
      <SettingsSectionBlock
        title={t('settings.graphics.skyAndNight')}
        description={t('settings.graphics.skyAndNightDesc')}
      >
        <SettingsToggleRow
          title={t('settings.graphics.dynamicSky')}
          description={t('settings.graphics.dynamicSkyDesc')}
          checked={graphics.dynamicSky}
          onCheckedChange={(checked) => updateGraphics({ dynamicSky: checked })}
        />
        <SettingsToggleRow
          title={t('settings.graphics.cityLights')}
          description={t('settings.graphics.cityLightsDesc')}
          checked={graphics.cityLights}
          onCheckedChange={(checked) => updateGraphics({ cityLights: checked })}
        />
        <SettingsToggleRow
          title={t('settings.graphics.followSimTime')}
          description={t('settings.graphics.followSimTimeDesc')}
          checked={graphics.followSimTime}
          onCheckedChange={(checked) => updateGraphics({ followSimTime: checked })}
        />
      </SettingsSectionBlock>

      {/* Airport effects */}
      <SettingsSectionBlock
        title={t('settings.graphics.airportEffects')}
        description={t('settings.graphics.airportEffectsDesc')}
      >
        <SettingsToggleRow
          title={t('settings.graphics.approachLights')}
          description={t('settings.graphics.approachLightsDesc')}
          checked={graphics.approachLightAnimation}
          onCheckedChange={(checked) => updateGraphics({ approachLightAnimation: checked })}
        />
        <SettingsToggleRow
          title={t('settings.graphics.groundWeather')}
          description={t('settings.graphics.groundWeatherDesc')}
          checked={graphics.groundWeather}
          onCheckedChange={(checked) => updateGraphics({ groundWeather: checked })}
        />
        <div className="space-y-2 pt-2">
          <div>
            <p className="text-sm font-medium">{t('settings.graphics.airfieldLights')}</p>
            <p className="text-muted-foreground text-xs">
              {t('settings.graphics.airfieldLightsDesc')}
            </p>
          </div>
          <div className="flex gap-2">
            {AIRFIELD_LIGHT_OPTIONS.map(({ value, labelKey }) => (
              <Button
                key={value}
                variant={graphics.airfieldLights === value ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'min-w-0 flex-1',
                  graphics.airfieldLights === value && 'pointer-events-none'
                )}
                onClick={() => updateGraphics({ airfieldLights: value })}
              >
                <span className="truncate">{t(labelKey)}</span>
              </Button>
            ))}
          </div>
        </div>
      </SettingsSectionBlock>
    </div>
  );
}
