import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  ChevronsUpDown,
  Cloud,
  CloudRain,
  Flashlight,
  Lightbulb,
  Plane,
  Radar,
  Route,
  Sunrise,
  Waves,
  Wind,
} from 'lucide-react';
import { isAirportFiltersActive } from '@/components/Map/hooks/useAirportFilters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import type { AirfieldLightsMode } from '@/lib/airportLights/lightFactor';
import { cn } from '@/lib/utils/helpers';
import { useDistinctCountries } from '@/queries';
import { type SurfaceTypeFilter, useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { NavLayerVisibility } from '@/types/layers';
import { ALL_RANGE_RING_CATEGORIES, RANGE_RING_COLORS, RANGE_RING_SPEEDS } from '@/types/layers';

const AIRFIELD_LIGHTS_ON: AirfieldLightsMode = 'on';
const AIRFIELD_LIGHTS_OFF: AirfieldLightsMode = 'off';

const SURFACE_CHIPS: { type: SurfaceTypeFilter; labelKey: string }[] = [
  { type: 'paved', labelKey: 'airportFilters.paved' },
  { type: 'unpaved', labelKey: 'airportFilters.unpaved' },
  { type: 'water', labelKey: 'airportFilters.water' },
  { type: 'other', labelKey: 'airportFilters.surfaceOther' },
];

const RANGE_RING_HOURS = [1, 2, 3, 5, 8] as const;

interface LayersPanelProps {
  navDataCounts: { navaids: number; ils: number; airspaces: number };
  onNavToggle: (layer: keyof NavLayerVisibility) => void;
  onToggleWeatherRadar: () => void;
  onToggleVatsim: () => void;
  onToggleIvao: () => void;
  vatsimPilotCount?: number;
  ivaoPilotCount?: number;
}

/** Section title with an optional action on the right, on the shared heading rule. */
function SectionHeading({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="xp-section-heading flex items-center justify-between">
      <span className="min-w-0 truncate">{children}</span>
      {action}
    </div>
  );
}

/**
 * A filter chip. Filters default to everything on, so "on" is the quiet
 * state and "off" reads as an empty slot: dashed outline, dimmed text.
 */
function Chip({
  pressed,
  disabled,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onPressedChange: () => void;
  children: string;
}) {
  return (
    <Toggle
      variant="subtle"
      size="xs"
      pressed={pressed}
      disabled={disabled}
      onPressedChange={onPressedChange}
      className="data-[state=off]:border-border data-[state=off]:text-muted-foreground/60 data-[state=on]:bg-secondary data-[state=on]:text-foreground min-w-0 flex-1 border border-transparent data-[state=off]:border-dashed data-[state=off]:bg-transparent data-[state=on]:ring-0"
    >
      <span className="truncate">{children}</span>
    </Toggle>
  );
}

/** A labelled switch row, with an optional count on the right of the label. */
function SwitchRow({
  label,
  checked,
  onCheckedChange,
  count,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-foreground min-w-0 flex-1 truncate text-sm">{label}</span>
      {count !== undefined && (
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{count}</span>
      )}
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

/** One overlay: icon and label on a compact row; the tint says whether it is on the map. */
function OverlayTile({
  icon: Icon,
  label,
  on,
  onToggle,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  on: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <Toggle
      variant="subtle"
      pressed={on}
      onPressedChange={onToggle}
      aria-label={label}
      title={label}
      className="data-[state=off]:bg-secondary/40 data-[state=off]:text-muted-foreground h-9 min-w-0 justify-start gap-2 px-2.5 text-sm font-normal data-[state=on]:ring-0 [&_svg]:size-4"
    >
      <Icon className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {badge}
    </Toggle>
  );
}

export function LayersPanel({
  navDataCounts,
  onNavToggle,
  onToggleWeatherRadar,
  onToggleVatsim,
  onToggleIvao,
  vatsimPilotCount,
  ivaoPilotCount,
}: LayersPanelProps) {
  const { t } = useTranslation();

  const airportFilters = useMapStore((s) => s.airportFilters);
  const setAirportFilters = useMapStore((s) => s.setAirportFilters);
  const resetAirportFilters = useMapStore((s) => s.resetAirportFilters);
  const navVisibility = useMapStore((s) => s.navVisibility);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);
  const ivaoEnabled = useMapStore((s) => s.ivaoEnabled);
  const weatherRadarEnabled = useMapStore((s) => s.weatherRadarEnabled);
  const cloudLayerEnabled = useMapStore((s) => s.cloudLayerEnabled);
  const setCloudLayerEnabled = useMapStore((s) => s.setCloudLayerEnabled);
  const flightTrailEnabled = useMapStore((s) => s.flightTrailEnabled);
  const setFlightTrailEnabled = useMapStore((s) => s.setFlightTrailEnabled);
  const simTrafficEnabled = useMapStore((s) => s.simTrafficEnabled);
  const setSimTrafficEnabled = useMapStore((s) => s.setSimTrafficEnabled);
  const rangeRingsEnabled = useMapStore((s) => s.rangeRingsEnabled);
  const setRangeRingsEnabled = useMapStore((s) => s.setRangeRingsEnabled);
  const rangeRingsDuration = useMapStore((s) => s.rangeRingsDuration);
  const setRangeRingsDuration = useMapStore((s) => s.setRangeRingsDuration);
  const rangeRingsCategories = useMapStore((s) => s.rangeRingsCategories);
  const toggleRangeRingsCategory = useMapStore((s) => s.toggleRangeRingsCategory);

  const dynamicSkyEnabled = useSettingsStore((s) => s.graphics.dynamicSky);
  const cityLightsEnabled = useSettingsStore((s) => s.graphics.cityLights);
  const groundWeatherEnabled = useSettingsStore((s) => s.graphics.groundWeather);
  const airfieldLightsOn = useSettingsStore((s) => s.graphics.airfieldLights !== 'off');
  const updateGraphicsSettings = useSettingsStore((s) => s.updateGraphicsSettings);

  const { data: countries = [] } = useDistinctCountries();
  const [countryOpen, setCountryOpen] = useState(false);

  const filtersActive = isAirportFiltersActive(airportFilters);
  const checkedTypeCount = [
    airportFilters.showLand,
    airportFilters.showSeaplane,
    airportFilters.showHeliport,
  ].filter(Boolean).length;
  /** The last airport type or surface left on cannot be switched off: it would blank the map. */
  const lastType = (checked: boolean) => checked && checkedTypeCount === 1;
  const lastSurface = (type: SurfaceTypeFilter) =>
    airportFilters.surfaceTypes.length === 1 && airportFilters.surfaceTypes.includes(type);

  const toggleSurfaceType = useCallback(
    (type: SurfaceTypeFilter) => {
      const current = airportFilters.surfaceTypes;
      const next = current.includes(type) ? current.filter((s) => s !== type) : [...current, type];
      setAirportFilters({ surfaceTypes: next });
    },
    [airportFilters.surfaceTypes, setAirportFilters]
  );

  const navLayers: { key: keyof NavLayerVisibility; labelKey: string; count: number }[] = [
    { key: 'navaids', labelKey: 'layers.items.navaids', count: navDataCounts.navaids },
    { key: 'ils', labelKey: 'layers.items.ils', count: navDataCounts.ils },
    { key: 'airspaces', labelKey: 'layers.navigation.airspaces', count: navDataCounts.airspaces },
  ];

  const overlays: {
    key: string;
    icon: LucideIcon;
    label: string;
    on: boolean;
    toggle: () => void;
    badge?: React.ReactNode;
  }[] = [
    {
      key: 'weather',
      icon: CloudRain,
      label: t('toolbar.weather'),
      on: weatherRadarEnabled,
      toggle: onToggleWeatherRadar,
    },
    {
      key: 'clouds',
      icon: Cloud,
      label: t('toolbar.satelliteClouds'),
      on: cloudLayerEnabled,
      toggle: () => setCloudLayerEnabled(!cloudLayerEnabled),
    },
    {
      key: 'sky',
      icon: Sunrise,
      label: t('toolbar.dynamicSky'),
      on: dynamicSkyEnabled,
      toggle: () => updateGraphicsSettings({ dynamicSky: !dynamicSkyEnabled }),
    },
    {
      key: 'city',
      icon: Lightbulb,
      label: t('toolbar.cityLights'),
      on: cityLightsEnabled,
      toggle: () => updateGraphicsSettings({ cityLights: !cityLightsEnabled }),
    },
    {
      key: 'ground',
      icon: Wind,
      label: t('toolbar.groundWeather'),
      on: groundWeatherEnabled,
      toggle: () => updateGraphicsSettings({ groundWeather: !groundWeatherEnabled }),
    },
    {
      key: 'airfield',
      icon: Flashlight,
      label: t('toolbar.airfieldLights'),
      on: airfieldLightsOn,
      toggle: () =>
        updateGraphicsSettings({
          airfieldLights: airfieldLightsOn ? AIRFIELD_LIGHTS_OFF : AIRFIELD_LIGHTS_ON,
        }),
    },
    {
      key: 'trail',
      icon: Route,
      label: t('toolbar.flightTrail'),
      on: flightTrailEnabled,
      toggle: () => setFlightTrailEnabled(!flightTrailEnabled),
    },
    {
      key: 'nat',
      icon: Waves,
      label: t('toolbar.natTracks'),
      on: navVisibility.natTracks,
      toggle: () => onNavToggle('natTracks'),
    },
    {
      key: 'sim',
      icon: Plane,
      label: t('toolbar.simTraffic'),
      on: simTrafficEnabled,
      toggle: () => setSimTrafficEnabled(!simTrafficEnabled),
    },
    {
      key: 'vatsim',
      icon: Radar,
      label: t('toolbar.vatsim'),
      on: vatsimEnabled,
      toggle: onToggleVatsim,
      badge:
        vatsimEnabled && vatsimPilotCount !== undefined ? (
          <Badge variant="success" className="text-2xs px-1 py-0">
            {vatsimPilotCount}
          </Badge>
        ) : undefined,
    },
    {
      key: 'ivao',
      icon: Radar,
      label: 'IVAO',
      on: ivaoEnabled,
      toggle: onToggleIvao,
      badge:
        ivaoEnabled && ivaoPilotCount !== undefined ? (
          <Badge variant="cat-blue" className="text-2xs px-1 py-0">
            {ivaoPilotCount}
          </Badge>
        ) : undefined,
    },
  ];

  return (
    <div className="flex max-h-[calc(100vh-7rem)] flex-col gap-4 overflow-y-auto p-4">
      {/* Airports: what the dots on the map are */}
      <section className="space-y-2">
        <SectionHeading
          action={
            filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetAirportFilters}
                className="text-muted-foreground hover:text-foreground h-5 px-1 text-xs tracking-normal normal-case"
              >
                {t('airportFilters.reset')}
              </Button>
            ) : undefined
          }
        >
          {t('airportFilters.title')}
        </SectionHeading>

        <div className="flex gap-1">
          <Chip
            pressed={airportFilters.showLand}
            disabled={lastType(airportFilters.showLand)}
            onPressedChange={() => setAirportFilters({ showLand: !airportFilters.showLand })}
          >
            {t('airportFilters.land')}
          </Chip>
          <Chip
            pressed={airportFilters.showSeaplane}
            disabled={lastType(airportFilters.showSeaplane)}
            onPressedChange={() =>
              setAirportFilters({ showSeaplane: !airportFilters.showSeaplane })
            }
          >
            {t('airportFilters.seaplane')}
          </Chip>
          <Chip
            pressed={airportFilters.showHeliport}
            disabled={lastType(airportFilters.showHeliport)}
            onPressedChange={() =>
              setAirportFilters({ showHeliport: !airportFilters.showHeliport })
            }
          >
            {t('airportFilters.heliport')}
          </Chip>
        </div>

        <div className="flex gap-1">
          {SURFACE_CHIPS.map(({ type, labelKey }) => (
            <Chip
              key={type}
              pressed={airportFilters.surfaceTypes.includes(type)}
              disabled={lastSurface(type)}
              onPressedChange={() => toggleSurfaceType(type)}
            >
              {t(labelKey)}
            </Chip>
          ))}
        </div>

        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={countryOpen}
              className="h-8 w-full justify-between px-2 text-sm"
            >
              <span className="truncate">
                {airportFilters.country === 'all'
                  ? t('airportFilters.allCountries')
                  : airportFilters.country}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start" side="left" sideOffset={12}>
            <Command>
              <CommandInput placeholder={t('common.search')} className="h-8" />
              <CommandList>
                <CommandEmpty>{t('common.noResults')}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => {
                      setAirportFilters({ country: 'all' });
                      setCountryOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        airportFilters.country === 'all' ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {t('airportFilters.allCountries')}
                  </CommandItem>
                  {countries.map((country) => (
                    <CommandItem
                      key={country}
                      value={country}
                      onSelect={() => {
                        setAirportFilters({ country });
                        setCountryOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          airportFilters.country === country ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {country}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <SwitchRow
          label={t('airportFilters.customOnly')}
          checked={airportFilters.onlyCustom}
          onCheckedChange={() => setAirportFilters({ onlyCustom: !airportFilters.onlyCustom })}
        />
      </section>

      {/* Navigation data around the selected airport */}
      <section className="space-y-1">
        <SectionHeading>{t('toolbar.aroundAirport')}</SectionHeading>
        {navLayers.map((layer) => (
          <SwitchRow
            key={layer.key}
            label={t(layer.labelKey)}
            count={layer.count}
            checked={navVisibility[layer.key] as boolean}
            onCheckedChange={() => onNavToggle(layer.key)}
          />
        ))}
      </section>

      {/* Overlays: one tile each, lit when on the map */}
      <section className="space-y-2">
        <SectionHeading>{t('toolbar.overlays')}</SectionHeading>
        <div className="grid grid-cols-2 gap-1.5">
          {overlays.map((o) => (
            <OverlayTile
              key={o.key}
              icon={o.icon}
              label={o.label}
              on={o.on}
              onToggle={o.toggle}
              badge={o.badge}
            />
          ))}
        </div>
      </section>

      {/* Range rings */}
      <section className="space-y-2">
        <SectionHeading>{t('toolbar.rangeRings')}</SectionHeading>
        <SwitchRow
          label={t('toolbar.enabled')}
          checked={rangeRingsEnabled}
          onCheckedChange={() => setRangeRingsEnabled(!rangeRingsEnabled)}
        />
        {rangeRingsEnabled && (
          <>
            <div className="flex gap-1">
              {RANGE_RING_HOURS.map((h) => (
                <Toggle
                  key={h}
                  variant="subtle"
                  size="xs"
                  pressed={rangeRingsDuration === h}
                  onPressedChange={() => setRangeRingsDuration(h)}
                  className="data-[state=off]:bg-secondary/40 data-[state=off]:text-muted-foreground data-[state=on]:bg-secondary data-[state=on]:text-foreground min-w-0 flex-1 data-[state=on]:ring-0"
                >
                  {t('toolbar.rangeRingsHours', { n: h })}
                </Toggle>
              ))}
            </div>
            <div className="space-y-0.5">
              {ALL_RANGE_RING_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex cursor-pointer items-center justify-between gap-3 py-1"
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: RANGE_RING_COLORS[cat] }}
                  />
                  <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                    {t(`planBuilder.class.${cat}`)}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {t('toolbar.rangeRingsKts', { speed: RANGE_RING_SPEEDS[cat] })}
                  </span>
                  <Switch
                    checked={rangeRingsCategories.includes(cat)}
                    onCheckedChange={() => toggleRangeRingsCategory(cat)}
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
