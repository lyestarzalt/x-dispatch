import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Anchor,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CloudDownload,
  CloudRain,
  Compass,
  FileUp,
  Flashlight,
  Layers,
  Lightbulb,
  MapPin,
  Package,
  Pause,
  Pencil,
  Plane,
  Play,
  Radar,
  Route,
  Search,
  Settings,
  Ship,
  Sunrise,
  Wind,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AirStartSpeedInput } from '@/components/AirStartSpeedInput';
import { isAirportFiltersActive } from '@/components/Map/hooks/useAirportFilters';
import type { WeatherRadarControls } from '@/components/Map/hooks/useWeatherRadar';
import { AddonManager } from '@/components/dialogs/AddonManager';
import SimbriefDialog from '@/components/dialogs/SimbriefDialog';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AirfieldLightsMode } from '@/lib/airportLights/lightFactor';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useDistinctCountries, useNavDataCounts } from '@/queries';
import { useIvaoQuery } from '@/queries/useIvaoQuery';
import { useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { type SurfaceTypeFilter, useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { NavLayerVisibility } from '@/types/layers';
import {
  ALL_RANGE_RING_CATEGORIES,
  RANGE_RING_COLORS,
  RANGE_RING_LABELS,
  RANGE_RING_SPEEDS,
} from '@/types/layers';

type CustomStartMode = 'ground' | 'air' | 'carrier' | 'frigate';

const AIRFIELD_LIGHTS_ON: AirfieldLightsMode = 'on';
const AIRFIELD_LIGHTS_OFF: AirfieldLightsMode = 'off';

const PIN_MODE_CONFIG: { mode: CustomStartMode; icon: typeof MapPin; labelKey: string }[] = [
  { mode: 'ground', icon: MapPin, labelKey: 'toolbar.pinModes.ground' },
  { mode: 'air', icon: Plane, labelKey: 'toolbar.pinModes.air' },
  { mode: 'carrier', icon: Anchor, labelKey: 'toolbar.pinModes.carrier' },
  { mode: 'frigate', icon: Ship, labelKey: 'toolbar.pinModes.frigate' },
];

const CATAPULT_POSITIONS = [
  'catapult_1',
  'catapult_2',
  'catapult_3',
  'catapult_4',
  'deck',
] as const;

function PinOptionsPopover({
  isCustomPin,
  onSubmit,
}: {
  isCustomPin: boolean;
  onSubmit: (lat: number, lon: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [editingCoords, setEditingCoords] = useState(false);

  const startPosition = useAppStore((s) => s.startPosition);
  const setStartPosition = useAppStore((s) => s.setStartPosition);
  const currentMode: CustomStartMode =
    (startPosition?.type === 'custom' && startPosition.customStartMode) || 'ground';

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  const isCoordValid =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180;

  const handleCoordSubmit = () => {
    if (!isCoordValid) return;
    onSubmit(parsedLat, parsedLon);
    setEditingCoords(false);
    setOpen(false);
    setLat('');
    setLon('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEditingCoords(false);
      const pos = useAppStore.getState().startPosition;
      if (pos?.type === 'custom' && pos.latitude != null && pos.longitude != null) {
        setLat(pos.latitude.toFixed(4));
        setLon(pos.longitude.toFixed(4));
      }
    }
    setOpen(nextOpen);
  };

  const updatePos = (fields: Partial<typeof startPosition>) => {
    if (!startPosition || startPosition.type !== 'custom') return;
    setStartPosition({ ...startPosition, ...fields });
  };

  const setMode = (mode: CustomStartMode) => {
    if (!startPosition || startPosition.type !== 'custom') return;
    setStartPosition({
      ...startPosition,
      customStartMode: mode,
      airAltitudeM: mode === 'air' ? (startPosition.airAltitudeM ?? 914.4) : undefined,
      airSpeedEnum: undefined,
      airSpeedMs: mode === 'air' ? startPosition.airSpeedMs : undefined,
      airSpeedUnit: startPosition.airSpeedUnit ?? 'kt',
      boatPosition: mode === 'carrier' ? 'catapult_1' : undefined,
      boatApproachNm: mode === 'carrier' || mode === 'frigate' ? 1.5 : undefined,
    });
  };

  const setBoatPosition = (pos: string | null) => {
    updatePos({
      boatPosition: pos as NonNullable<typeof startPosition>['boatPosition'],
      boatApproachNm: pos ? undefined : startPosition?.boatApproachNm,
    });
  };

  const airAltFt = Math.round((startPosition?.airAltitudeM ?? 914.4) / 0.3048);
  const isBoatMode = currentMode === 'carrier' || currentMode === 'frigate';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 rounded-l-none px-1.5',
            isCustomPin && 'border-success/50 text-success'
          )}
          aria-label={t('toolbar.pinCoordinates')}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-3" align="end">
        {/* Start mode selector */}
        <div>
          <span className="xp-section-heading mb-1.5 block">{t('toolbar.pinModes.title')}</span>
          <div className="grid grid-cols-2 gap-1">
            {PIN_MODE_CONFIG.map(({ mode, icon: Icon, labelKey }) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                disabled={!isCustomPin}
                onClick={() => setMode(mode)}
                className={cn(
                  'h-7 justify-start gap-1.5 text-sm',
                  currentMode === mode && isCustomPin
                    ? 'bg-success/10 text-success'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(labelKey)}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Air start options ── */}
        {isCustomPin && currentMode === 'air' && (
          <div className="border-border/40 bg-muted/20 space-y-2.5 rounded-lg border p-2.5">
            {/* Altitude */}
            <div>
              <div className="flex items-center justify-between">
                <span className="xp-label">{t('toolbar.pinModes.altitude')}</span>
                <span className="xp-value">
                  {airAltFt.toLocaleString()}
                  <span className="text-muted-foreground ml-0.5 text-xs">{t('units.ft')}</span>
                </span>
              </div>
              <Slider
                className="mt-1.5"
                min={500}
                max={45000}
                step={500}
                value={[airAltFt]}
                onValueChange={([v]) => {
                  if (v !== undefined) updatePos({ airAltitudeM: v * 0.3048 });
                }}
              />
            </div>

            <AirStartSpeedInput position={startPosition!} onChange={updatePos} />
          </div>
        )}

        {/* ── Boat start options ── */}
        {isCustomPin && isBoatMode && (
          <div className="border-border/40 bg-muted/20 space-y-2.5 rounded-lg border p-2.5">
            {/* Carrier: deck position OR approach */}
            {currentMode === 'carrier' && (
              <div>
                <span className="xp-label mb-1.5 block">{t('toolbar.pinModes.position')}</span>
                <div className="flex flex-wrap gap-1">
                  {CATAPULT_POSITIONS.map((pos) => (
                    <Button
                      key={pos}
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBoatPosition(startPosition?.boatPosition === pos ? null : pos)
                      }
                      className={cn(
                        'h-7 px-2.5 text-sm',
                        startPosition?.boatPosition === pos
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {t(`toolbar.pinModes.cat_${pos}`)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Approach — for both carrier (when no deck position) and frigate (always) */}
            {(currentMode === 'frigate' || !startPosition?.boatPosition) && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="xp-label">{t('toolbar.pinModes.approach')}</span>
                  <span className="xp-value">
                    {startPosition?.boatApproachNm ?? 1.5}
                    <span className="text-muted-foreground ml-0.5 text-xs">{t('units.nm')}</span>
                  </span>
                </div>
                <Slider
                  className="mt-1.5"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={[startPosition?.boatApproachNm ?? 1.5]}
                  onValueChange={([v]) => updatePos({ boatApproachNm: v, boatPosition: undefined })}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Coordinates ── */}
        <div className="border-border/30 border-t pt-2.5">
          {isCustomPin && !editingCoords ? (
            /* Compact read-only display when pin is placed */
            <button
              onClick={() => setEditingCoords(true)}
              className="hover:bg-muted/50 flex w-full items-center justify-between rounded px-1 py-1 text-left transition-colors"
            >
              <span className="text-muted-foreground font-mono text-sm">
                {t('toolbar.pinCoords', {
                  lat: startPosition?.latitude.toFixed(4),
                  lon: startPosition?.longitude.toFixed(4),
                })}
              </span>
              <Pencil className="text-muted-foreground/50 h-3 w-3" />
            </button>
          ) : (
            /* Editable form — shown when no pin or user clicks edit */
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="xp-label w-8 shrink-0">{t('toolbar.pinLat')}</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="43.6585"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCoordSubmit()}
                  className="h-7 font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="xp-label w-8 shrink-0">{t('toolbar.pinLon')}</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="7.2156"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCoordSubmit()}
                  className="h-7 font-mono text-sm"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!isCoordValid}
                onClick={handleCoordSubmit}
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                {t('toolbar.pinDropAndFly')}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ToolbarProps {
  airports: Airport[];
  onSelectAirport: (airport: Airport) => void;
  onToggleVatsim: () => void;
  onToggleIvao: () => void;
  onToggleWeatherRadar: () => void;
  weatherRadarControls: WeatherRadarControls;
  onNavToggle: (layer: keyof NavLayerVisibility) => void;
  onPinDrop: () => void;
  onPinDropAtCoordinates: (lat: number, lon: number) => void;
}

function Toolbar({
  airports,
  onSelectAirport,
  onToggleVatsim,
  onToggleIvao,
  onToggleWeatherRadar,
  weatherRadarControls,
  onNavToggle,
  onPinDrop,
  onPinDropAtCoordinates,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addonManagerOpen, setAddonManagerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // App store
  const selectedICAO = useAppStore((s) => s.selectedICAO);
  const selectedAirportData = useAppStore((s) => s.selectedAirportData);
  const hasStartPosition = useAppStore((s) => !!s.startPosition);
  const isCustomPin = useAppStore((s) => s.startPosition?.type === 'custom');
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setShowLaunchDialog = useAppStore((s) => s.setShowLaunchDialog);
  const openLogbook = useAppStore((s) => s.openLogbook);
  const logbookOpen = useAppStore((s) => s.logbook.open);

  // Map store
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);
  const ivaoEnabled = useMapStore((s) => s.ivaoEnabled);
  const simTrafficEnabled = useMapStore((s) => s.simTrafficEnabled);
  const setSimTrafficEnabled = useMapStore((s) => s.setSimTrafficEnabled);
  const navVisibility = useMapStore((s) => s.navVisibility);
  const weatherRadarEnabled = useMapStore((s) => s.weatherRadarEnabled);
  const flightTrailEnabled = useMapStore((s) => s.flightTrailEnabled);
  const setFlightTrailEnabled = useMapStore((s) => s.setFlightTrailEnabled);
  const dynamicSkyEnabled = useSettingsStore((s) => s.graphics.dynamicSky);
  const cityLightsEnabled = useSettingsStore((s) => s.graphics.cityLights);
  const groundWeatherEnabled = useSettingsStore((s) => s.graphics.groundWeather);
  const airfieldLightsOn = useSettingsStore((s) => s.graphics.airfieldLights !== 'off');
  const updateGraphicsSettings = useSettingsStore((s) => s.updateGraphicsSettings);
  const exploreOpen = useMapStore((s) => s.explore.isOpen);
  const setExploreOpen = useMapStore((s) => s.setExploreOpen);
  const airportFilters = useMapStore((s) => s.airportFilters);
  const setAirportFilters = useMapStore((s) => s.setAirportFilters);
  const resetAirportFilters = useMapStore((s) => s.resetAirportFilters);
  const rangeRingsEnabled = useMapStore((s) => s.rangeRingsEnabled);
  const setRangeRingsEnabled = useMapStore((s) => s.setRangeRingsEnabled);
  const rangeRingsDuration = useMapStore((s) => s.rangeRingsDuration);
  const setRangeRingsDuration = useMapStore((s) => s.setRangeRingsDuration);
  const rangeRingsCategories = useMapStore((s) => s.rangeRingsCategories);
  const toggleRangeRingsCategory = useMapStore((s) => s.toggleRangeRingsCategory);
  const filtersActive = isAirportFiltersActive(airportFilters);
  const [countryOpen, setCountryOpen] = useState(false);

  // Country list query
  const { data: countries = [] } = useDistinctCountries();

  // Flight plan store
  const loadFMSFile = useFlightPlanStore((s) => s.loadFMSFile);
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);
  const simbriefOpen = useFlightPlanStore((s) => s.simbriefDialogOpen);
  const openSimbriefDialog = useFlightPlanStore((s) => s.openSimbriefDialog);
  const closeSimbriefDialog = useFlightPlanStore((s) => s.closeSimbriefDialog);

  // Queries
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const vatsimPilotCount = vatsimData?.pilots?.length;
  const { data: ivaoData } = useIvaoQuery(ivaoEnabled);
  const ivaoPilotCount = ivaoData?.clients.pilots.length;

  // Nav data counts - derived from airport location
  const selectedAirport = useMemo(
    () => airports.find((a) => a.icao === selectedICAO),
    [airports, selectedICAO]
  );
  const airportLat =
    selectedAirport?.lat ??
    (selectedAirportData?.metadata?.datum_lat
      ? parseFloat(selectedAirportData.metadata.datum_lat)
      : null);
  const airportLon =
    selectedAirport?.lon ??
    (selectedAirportData?.metadata?.datum_lon
      ? parseFloat(selectedAirportData.metadata.datum_lon)
      : null);
  const navDataCounts = useNavDataCounts(airportLat, airportLon);

  const toggleSurfaceType = useCallback(
    (type: SurfaceTypeFilter) => {
      const current = airportFilters.surfaceTypes;
      const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
      setAirportFilters({ surfaceTypes: next });
    },
    [airportFilters.surfaceTypes, setAirportFilters]
  );

  const filteredAirports = useMemo(() => {
    const query = searchQuery.trim().toUpperCase();
    if (query.length < 2) return [];

    const matches = airports.filter(
      (a) => a.icao.toUpperCase().includes(query) || a.name.toUpperCase().includes(query)
    );

    matches.sort((a, b) => {
      const aIcao = a.icao.toUpperCase();
      const bIcao = b.icao.toUpperCase();

      if (aIcao === query && bIcao !== query) return -1;
      if (bIcao === query && aIcao !== query) return 1;

      const aStartsWith = aIcao.startsWith(query);
      const bStartsWith = bIcao.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (bStartsWith && !aStartsWith) return 1;

      const aIcaoContains = aIcao.includes(query);
      const bIcaoContains = bIcao.includes(query);
      if (aIcaoContains && !bIcaoContains) return -1;
      if (bIcaoContains && !aIcaoContains) return 1;

      return 0;
    });

    return matches.slice(0, 8);
  }, [airports, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
    setShowResults(query.trim().length >= 2);
  }, []);

  const handleSelect = useCallback(
    (airport: Airport) => {
      setShowResults(false);
      setSearchQuery('');
      onSelectAirport(airport);
      inputRef.current?.blur();
    },
    [onSelectAirport]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showResults || filteredAirports.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredAirports.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredAirports.length) % filteredAirports.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredAirports[selectedIndex];
        if (selected) handleSelect(selected);
      } else if (e.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    },
    [showResults, filteredAirports, selectedIndex, handleSelect]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ctrl+F / Cmd+F focuses the search input
  useEffect(() => {
    return window.appAPI.onFocusSearch(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const handleLoadFlightPlan = useCallback(async () => {
    const result = await window.flightPlanAPI.openFile();
    if (result) {
      await loadFMSFile(result.content, result.fileName);
    }
  }, [loadFMSFile]);

  const totalNavItems = navDataCounts.navaids + navDataCounts.ils + navDataCounts.airspaces;

  const localNavLayers: { key: keyof NavLayerVisibility; labelKey: string; count: number }[] = [
    { key: 'navaids', labelKey: 'layers.items.navaids', count: navDataCounts.navaids },
    { key: 'ils', labelKey: 'layers.items.ils', count: navDataCounts.ils },
    { key: 'airspaces', labelKey: 'layers.navigation.airspaces', count: navDataCounts.airspaces },
  ];

  const layersActive =
    filtersActive ||
    totalNavItems > 0 ||
    weatherRadarEnabled ||
    vatsimEnabled ||
    ivaoEnabled ||
    rangeRingsEnabled;

  return (
    <div className="relative flex items-center gap-3">
      {/* Search */}
      <div ref={containerRef} className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={t('toolbar.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => filteredAirports.length > 0 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          className="h-9 w-[300px]"
          endIcon={
            searchQuery ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                }}
                aria-label={t('toolbar.clearSearch')}
              >
                <X />
              </Button>
            ) : (
              <Search />
            )
          }
        />

        {showResults && filteredAirports.length > 0 && (
          <div className="border-border bg-popover absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border">
            {filteredAirports.map((airport, index) => (
              <Button
                key={airport.icao}
                data-testid="search-result"
                variant="ghost"
                onClick={() => handleSelect(airport)}
                className={cn(
                  'flex h-auto w-full justify-start gap-3 rounded-none px-3 py-2',
                  index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <span className="text-primary w-16 shrink-0 font-mono font-semibold">
                  {airport.icao}
                </span>
                <span className="truncate">{airport.name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Addon Manager */}
      <Button
        variant="outline"
        onClick={() => setAddonManagerOpen(true)}
        className="h-9 gap-2 px-3"
        tooltip={t('toolbar.tooltips.addons')}
      >
        <Package className="h-4 w-4" />
        <span className="text-sm font-medium">{t('toolbar.addons')}</span>
        <Badge variant="warning" className="px-1.5 py-0.5 text-[10px] leading-none uppercase">
          {t('toolbar.alphaTag')}
        </Badge>
      </Button>

      {/* Flight Plan dropdown */}
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-9 gap-2 px-3',
                  (fmsData || simbriefData) && 'border-info/50 text-info'
                )}
              >
                <FileUp className="h-4 w-4" />
                <span className="text-sm font-medium">{t('toolbar.flightPlan')}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tooltips.flightPlan')}</p>
          </TooltipContent>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem
              onClick={handleLoadFlightPlan}
              className={cn(fmsData && !simbriefData && 'text-info')}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {t('toolbar.loadPlan')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={openSimbriefDialog}
              className={cn(simbriefData && 'text-info')}
            >
              <CloudDownload className="mr-2 h-4 w-4" />
              SimBrief
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>

      {/* Explore button */}
      <Button
        variant="outline"
        onClick={() => setExploreOpen(!exploreOpen)}
        className={cn('h-9 gap-2 px-3', exploreOpen && 'border-primary/50 text-primary')}
        tooltip={t('toolbar.tooltips.explore')}
      >
        <Compass className={cn('h-4 w-4', exploreOpen && 'animate-pulse')} />
        <span className="text-sm font-medium">{t('explore.title')}</span>
      </Button>

      {/* Logbook button */}
      <Button
        variant="outline"
        onClick={() => openLogbook()}
        className={cn('h-9 gap-2 px-3', logbookOpen && 'border-primary/50 text-primary')}
        tooltip={t('toolbar.tooltips.logbook')}
      >
        <BookOpen className="h-4 w-4" />
        <span className="text-sm font-medium">{t('toolbar.logbook')}</span>
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Layers dropdown */}
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('h-9 gap-2 px-3', layersActive && 'border-primary/50 text-primary')}
                >
                  <Layers className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('toolbar.layers')}</span>
                  {layersActive && <span className="bg-primary h-2 w-2 rounded-full" />}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('toolbar.tooltips.layers')}</p>
            </TooltipContent>
            <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
              {/* Airports section */}
              <DropdownMenuLabel className="xp-section-heading">
                {t('airportFilters.title')}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={airportFilters.showLand}
                onCheckedChange={() => setAirportFilters({ showLand: !airportFilters.showLand })}
              >
                {t('airportFilters.land')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={airportFilters.showSeaplane}
                onCheckedChange={() =>
                  setAirportFilters({ showSeaplane: !airportFilters.showSeaplane })
                }
              >
                {t('airportFilters.seaplane')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={airportFilters.showHeliport}
                onCheckedChange={() =>
                  setAirportFilters({ showHeliport: !airportFilters.showHeliport })
                }
              >
                {t('airportFilters.heliport')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={airportFilters.onlyCustom}
                onCheckedChange={() =>
                  setAirportFilters({ onlyCustom: !airportFilters.onlyCustom })
                }
              >
                {t('airportFilters.customOnly')}
              </DropdownMenuCheckboxItem>

              {/* Runway surface sub-filter */}
              <DropdownMenuLabel className="text-muted-foreground/50 pl-6 text-xs tracking-wider uppercase">
                {t('airportFilters.runwaySurface')}
              </DropdownMenuLabel>
              {(
                [
                  { type: 'paved', labelKey: 'airportFilters.paved' },
                  { type: 'unpaved', labelKey: 'airportFilters.unpaved' },
                  { type: 'water', labelKey: 'airportFilters.water' },
                  { type: 'other', labelKey: 'airportFilters.surfaceOther' },
                ] as const
              ).map(({ type, labelKey }) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={airportFilters.surfaceTypes.includes(type)}
                  onCheckedChange={() => toggleSurfaceType(type)}
                >
                  {t(labelKey)}
                </DropdownMenuCheckboxItem>
              ))}

              {/* Country sub-filter */}
              <DropdownMenuLabel className="text-muted-foreground/50 pl-6 text-xs tracking-wider uppercase">
                {t('airportFilters.country')}
              </DropdownMenuLabel>
              <div className="px-1 pb-1">
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
                      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0" align="start" side="left" sideOffset={8}>
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
              </div>

              {filtersActive && (
                <Button
                  variant="ghost"
                  onClick={resetAirportFilters}
                  className="text-muted-foreground hover:text-foreground h-auto w-full rounded-none px-2 py-1.5 text-sm"
                >
                  {t('airportFilters.reset')}
                </Button>
              )}

              <DropdownMenuSeparator />

              {/* Navigation section */}
              <DropdownMenuLabel className="xp-section-heading">
                {t('toolbar.aroundAirport')}
              </DropdownMenuLabel>
              {localNavLayers.map((layer) => (
                <DropdownMenuCheckboxItem
                  key={layer.key}
                  checked={navVisibility[layer.key] as boolean}
                  onCheckedChange={() => onNavToggle(layer.key)}
                >
                  <span className="flex-1">{t(layer.labelKey)}</span>
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {layer.count}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator />

              {/* Overlays section */}
              <DropdownMenuLabel className="xp-section-heading">
                {t('toolbar.overlays')}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={weatherRadarEnabled}
                onCheckedChange={onToggleWeatherRadar}
              >
                <CloudRain className="mr-2 h-4 w-4" />
                {t('toolbar.weather')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={dynamicSkyEnabled}
                onCheckedChange={() => updateGraphicsSettings({ dynamicSky: !dynamicSkyEnabled })}
              >
                <Sunrise className="mr-2 h-4 w-4" />
                {t('toolbar.dynamicSky')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={cityLightsEnabled}
                onCheckedChange={() => updateGraphicsSettings({ cityLights: !cityLightsEnabled })}
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                {t('toolbar.cityLights')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={groundWeatherEnabled}
                onCheckedChange={() =>
                  updateGraphicsSettings({ groundWeather: !groundWeatherEnabled })
                }
              >
                <Wind className="mr-2 h-4 w-4" />
                {t('toolbar.groundWeather')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={airfieldLightsOn}
                onCheckedChange={(checked) =>
                  updateGraphicsSettings({
                    airfieldLights: checked ? AIRFIELD_LIGHTS_ON : AIRFIELD_LIGHTS_OFF,
                  })
                }
              >
                <Flashlight className="mr-2 h-4 w-4" />
                {t('toolbar.airfieldLights')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={flightTrailEnabled}
                onCheckedChange={() => setFlightTrailEnabled(!flightTrailEnabled)}
              >
                <Route className="mr-2 h-4 w-4" />
                {t('toolbar.flightTrail')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={simTrafficEnabled}
                onCheckedChange={() => setSimTrafficEnabled(!simTrafficEnabled)}
              >
                <Plane className="mr-2 h-4 w-4" />
                {t('toolbar.simTraffic')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={vatsimEnabled} onCheckedChange={onToggleVatsim}>
                <Radar className="mr-2 h-4 w-4" />
                {t('toolbar.vatsim')}
                {vatsimEnabled && vatsimPilotCount !== undefined && (
                  <Badge variant="success" className="ml-auto px-1.5 py-0.5">
                    {vatsimPilotCount}
                  </Badge>
                )}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={ivaoEnabled} onCheckedChange={onToggleIvao}>
                <Radar className="mr-2 h-4 w-4" />
                IVAO
                {ivaoEnabled && ivaoPilotCount !== undefined && (
                  <Badge variant="cat-blue" className="ml-auto px-1.5 py-0.5">
                    {ivaoPilotCount}
                  </Badge>
                )}
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />

              {/* Range Rings section */}
              <DropdownMenuLabel className="xp-section-heading">
                {t('toolbar.rangeRings')}
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={rangeRingsEnabled}
                onCheckedChange={() => setRangeRingsEnabled(!rangeRingsEnabled)}
              >
                {t('toolbar.enabled')}
              </DropdownMenuCheckboxItem>
              {rangeRingsEnabled && (
                <>
                  <div className="flex gap-1 px-2 py-1.5">
                    {([1, 2, 3, 5, 8] as const).map((h) => (
                      <Button
                        key={h}
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRangeRingsDuration(h);
                        }}
                        className={cn(
                          'h-6 flex-1 px-0 text-xs',
                          rangeRingsDuration === h && 'bg-primary/20 text-primary'
                        )}
                      >
                        {t('toolbar.rangeRingsHours', { n: h })}
                      </Button>
                    ))}
                  </div>
                  {ALL_RANGE_RING_CATEGORIES.map((cat) => (
                    <DropdownMenuCheckboxItem
                      key={cat}
                      checked={rangeRingsCategories.includes(cat)}
                      onCheckedChange={() => toggleRangeRingsCategory(cat)}
                    >
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: RANGE_RING_COLORS[cat] }}
                      />
                      <span className="flex-1">{RANGE_RING_LABELS[cat]}</span>
                      <span className="text-muted-foreground ml-2 font-mono text-xs">
                        {t('toolbar.rangeRingsKts', { speed: RANGE_RING_SPEEDS[cat] })}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>

        {/* Weather playback controls (inline, no toggle) */}
        {weatherRadarEnabled && <WeatherRadarPlayback controls={weatherRadarControls} />}

        {/* Pin Drop — split button: click = drop at center, chevron = coordinate input */}
        <div className="flex">
          <Button
            variant="outline"
            onClick={onPinDrop}
            className={cn(
              'h-9 gap-2 rounded-r-none border-r-0 px-3',
              isCustomPin && 'border-success/50 text-success'
            )}
            tooltip={t('toolbar.tooltips.pin')}
          >
            <MapPin className="h-4 w-4" />
            <span className="min-w-0 truncate text-sm font-medium">{t('toolbar.pin')}</span>
          </Button>
          <PinOptionsPopover isCustomPin={isCustomPin} onSubmit={onPinDropAtCoordinates} />
        </div>

        {/* Launch */}
        <Button
          data-testid="open-launch-dialog"
          variant="outline"
          onClick={() => {
            if (hasStartPosition) {
              setShowLaunchDialog(true);
            } else {
              toast.info(t('toolbar.tooltips.launchSelectPosition'));
            }
          }}
          className={cn(
            'h-9 gap-2 px-3',
            hasStartPosition && 'border-success/50 text-success',
            !hasStartPosition && 'opacity-50'
          )}
        >
          <Plane className="h-4 w-4" />
          <span className="text-sm font-medium">{t('toolbar.launch')}</span>
        </Button>

        {/* Settings */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="h-9 w-10"
          tooltip={t('toolbar.tooltips.settings')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialogs */}
      <SimbriefDialog open={simbriefOpen} onClose={closeSimbriefDialog} />
      <AddonManager open={addonManagerOpen} onClose={() => setAddonManagerOpen(false)} />
    </div>
  );
}

// The parent Map re-renders on airport selection and store toggles; the
// toolbar's own state comes from stores, so identical props mean no work.
export default memo(Toolbar);

/* ---------- Weather radar playback controls (no toggle, controls only) ---------- */

function WeatherRadarPlayback({ controls }: { controls: WeatherRadarControls }) {
  const {
    isPlaying,
    currentTimestamp,
    frameIndex,
    frameCount,
    play,
    pause,
    stepForward,
    stepBack,
  } = controls;

  const timeDisplay = useMemo(() => {
    if (currentTimestamp === null) return '--:--';
    const date = new Date(currentTimestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [currentTimestamp]);

  if (frameCount === 0) return null;

  return (
    <div className="border-primary/50 bg-primary/10 animate-in fade-in slide-in-from-left-2 flex h-9 items-center gap-0.5 rounded-md border px-1.5 duration-200">
      <Button
        variant="ghost"
        size="icon"
        onClick={stepBack}
        className="text-foreground/60 hover:bg-foreground/10 hover:text-foreground h-6 w-6"
        aria-label="Previous frame"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={isPlaying ? pause : play}
        className="text-primary hover:bg-foreground/10 hover:text-xp-cyan-light h-6 w-6"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={stepForward}
        className="text-foreground/60 hover:bg-foreground/10 hover:text-foreground h-6 w-6"
        aria-label="Next frame"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>

      <span className="text-primary ml-1 font-mono text-xs tabular-nums">{timeDisplay}</span>
      <span className="text-foreground/40 mr-1 ml-0.5 text-[10px]">
        {frameIndex + 1}/{frameCount}
      </span>
    </div>
  );
}
