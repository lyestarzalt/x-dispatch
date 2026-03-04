import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CloudDownload,
  CloudRain,
  Compass,
  FileUp,
  Layers,
  Locate,
  Package,
  Pause,
  Plane,
  Play,
  Radar,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useDistinctCountries, useNavDataCounts, usePlaneState } from '@/queries';
import { useIvaoQuery } from '@/queries/useIvaoQuery';
import { useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { ALL_SURFACE_TYPES, type SurfaceTypeFilter, useMapStore } from '@/stores/mapStore';
import type { NavLayerVisibility } from '@/types/layers';

interface ToolbarProps {
  airports: Airport[];
  onSelectAirport: (airport: Airport) => void;
  onToggleVatsim: () => void;
  onToggleIvao: () => void;
  onTogglePlaneTracker: () => void;
  onToggleWeatherRadar: () => void;
  weatherRadarControls: WeatherRadarControls;
  onNavToggle: (layer: keyof NavLayerVisibility) => void;
}

export default function Toolbar({
  airports,
  onSelectAirport,
  onToggleVatsim,
  onToggleIvao,
  onTogglePlaneTracker,
  onToggleWeatherRadar,
  weatherRadarControls,
  onNavToggle,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [simbriefOpen, setSimbriefOpen] = useState(false);
  const [addonManagerOpen, setAddonManagerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // App store
  const selectedICAO = useAppStore((s) => s.selectedICAO);
  const selectedAirportData = useAppStore((s) => s.selectedAirportData);
  const hasStartPosition = useAppStore((s) => !!s.startPosition);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setShowLaunchDialog = useAppStore((s) => s.setShowLaunchDialog);

  // Map store
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);
  const ivaoEnabled = useMapStore((s) => s.ivaoEnabled);
  const showPlaneTracker = useMapStore((s) => s.showPlaneTracker);
  const navVisibility = useMapStore((s) => s.navVisibility);
  const weatherRadarEnabled = useMapStore((s) => s.weatherRadarEnabled);
  const exploreOpen = useMapStore((s) => s.explore.isOpen);
  const setExploreOpen = useMapStore((s) => s.setExploreOpen);
  const airportFilters = useMapStore((s) => s.airportFilters);
  const setAirportFilters = useMapStore((s) => s.setAirportFilters);
  const resetAirportFilters = useMapStore((s) => s.resetAirportFilters);
  const filtersActive = isAirportFiltersActive(airportFilters);
  const [countryOpen, setCountryOpen] = useState(false);

  // Country list query
  const { data: countries = [] } = useDistinctCountries();

  // Flight plan store
  const loadFMSFile = useFlightPlanStore((s) => s.loadFMSFile);
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);

  // Queries
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const vatsimPilotCount = vatsimData?.pilots?.length;
  const { data: ivaoData } = useIvaoQuery(ivaoEnabled);
  const ivaoPilotCount = ivaoData?.clients.pilots.length;
  const { connected: isXPlaneConnected } = usePlaneState();

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
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toUpperCase();

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
    setShowResults(query.length >= 2);
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
        handleSelect(filteredAirports[selectedIndex]);
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
    filtersActive || totalNavItems > 0 || weatherRadarEnabled || vatsimEnabled || ivaoEnabled;

  return (
    <div className="relative flex items-center gap-3">
      {/* Search */}
      <div ref={containerRef} className="relative">
        <div className="flex h-9 w-[300px] items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-1 focus-within:ring-ring">
          <Input
            ref={inputRef}
            type="text"
            placeholder={t('toolbar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => filteredAirports.length > 0 && setShowResults(true)}
            onKeyDown={handleKeyDown}
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {searchQuery ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => {
                setSearchQuery('');
                setShowResults(false);
              }}
              aria-label={t('toolbar.clearSearch')}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        {showResults && filteredAirports.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover">
            {filteredAirports.map((airport, index) => (
              <Button
                key={airport.icao}
                variant="ghost"
                onClick={() => handleSelect(airport)}
                className={cn(
                  'flex h-auto w-full justify-start gap-3 rounded-none px-3 py-2',
                  index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <span className="w-16 shrink-0 font-mono font-semibold text-primary">
                  {airport.icao}
                </span>
                <span className="truncate">{airport.name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Addon Manager */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setAddonManagerOpen(true)}
              className="h-9 gap-2 px-3"
            >
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Addons</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Manage aircraft, scenery & plugins</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Flight Plan dropdown */}
      <TooltipProvider>
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
                onClick={() => setSimbriefOpen(true)}
                className={cn(simbriefData && 'text-info')}
              >
                <CloudDownload className="mr-2 h-4 w-4" />
                SimBrief
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>
      </TooltipProvider>

      {/* Explore button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setExploreOpen(!exploreOpen)}
              className={cn('h-9 gap-2 px-3', exploreOpen && 'border-primary/50 text-primary')}
            >
              <Compass className={cn('h-4 w-4', exploreOpen && 'animate-pulse')} />
              <span className="text-sm font-medium">{t('explore.title')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tooltips.explore')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Track button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={onTogglePlaneTracker}
              className={cn(
                'h-9 gap-2 px-3',
                showPlaneTracker && isXPlaneConnected && 'border-info/50 text-info'
              )}
            >
              <Locate
                className={cn('h-4 w-4', showPlaneTracker && isXPlaneConnected && 'animate-pulse')}
              />
              <span className="text-sm font-medium">{t('toolbar.track')}</span>
              {showPlaneTracker && isXPlaneConnected && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-info" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tooltips.track')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Layers dropdown */}
        <TooltipProvider>
          <Tooltip>
            <DropdownMenu>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 gap-2 px-3',
                      layersActive && 'border-primary/50 text-primary'
                    )}
                  >
                    <Layers className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('toolbar.layers')}</span>
                    {layersActive && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('toolbar.tooltips.layers')}</p>
              </TooltipContent>
              <DropdownMenuContent align="end" className="w-56">
                {/* Airports section */}
                <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
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

                <DropdownMenuSeparator />

                {/* Surface Type section */}
                <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {t('airportFilters.surfaceType')}
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

                <DropdownMenuSeparator />

                {/* Country section */}
                <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {t('airportFilters.country')}
                </DropdownMenuLabel>
                <div className="px-1 pb-1">
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={countryOpen}
                        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-sm hover:bg-accent"
                      >
                        <span className="truncate">
                          {airportFilters.country === 'all'
                            ? t('airportFilters.allCountries')
                            : airportFilters.country}
                        </span>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </button>
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
                  <button
                    onClick={resetAirportFilters}
                    className="w-full px-2 py-1.5 text-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t('airportFilters.reset')}
                  </button>
                )}

                <DropdownMenuSeparator />

                {/* Navigation section */}
                <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  Around Airport (50nm)
                </DropdownMenuLabel>
                {localNavLayers.map((layer) => (
                  <DropdownMenuCheckboxItem
                    key={layer.key}
                    checked={navVisibility[layer.key] as boolean}
                    onCheckedChange={() => onNavToggle(layer.key)}
                  >
                    <span className="flex-1">{t(layer.labelKey)}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {layer.count}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />

                {/* Overlays section */}
                <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  {t('toolbar.overlays')}
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={weatherRadarEnabled}
                  onCheckedChange={onToggleWeatherRadar}
                >
                  <CloudRain className="mr-2 h-4 w-4" />
                  {t('toolbar.weather')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={vatsimEnabled} onCheckedChange={onToggleVatsim}>
                  <Radar className="mr-2 h-4 w-4" />
                  {t('toolbar.vatsim')}
                  {vatsimEnabled && vatsimPilotCount !== undefined && (
                    <Badge className="ml-auto bg-success/20 px-1.5 py-0.5 text-success">
                      {vatsimPilotCount}
                    </Badge>
                  )}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={ivaoEnabled} onCheckedChange={onToggleIvao}>
                  <Radar className="mr-2 h-4 w-4" />
                  IVAO
                  {ivaoEnabled && ivaoPilotCount !== undefined && (
                    <Badge className="ml-auto bg-blue-500/20 px-1.5 py-0.5 text-blue-500">
                      {ivaoPilotCount}
                    </Badge>
                  )}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Tooltip>
        </TooltipProvider>

        {/* Weather playback controls (inline, no toggle) */}
        {weatherRadarEnabled && <WeatherRadarPlayback controls={weatherRadarControls} />}

        {/* Launch */}
        <Button
          variant="outline"
          onClick={() => {
            if (hasStartPosition) {
              setShowLaunchDialog(true);
            } else {
              toast.info(
                selectedICAO
                  ? t('toolbar.tooltips.launchSelectPosition')
                  : t('toolbar.tooltips.launchDisabled')
              );
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-9 w-10"
                aria-label={t('settings.title')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('toolbar.tooltips.settings')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Dialogs */}
      <SimbriefDialog open={simbriefOpen} onClose={() => setSimbriefOpen(false)} />
      <AddonManager open={addonManagerOpen} onClose={() => setAddonManagerOpen(false)} />
    </div>
  );
}

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
    <div className="flex h-9 items-center gap-0.5 rounded-md border border-cyan-500/50 bg-cyan-500/10 px-1.5 duration-200 animate-in fade-in slide-in-from-left-2">
      <button
        onClick={stepBack}
        className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Previous frame"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <button
        onClick={isPlaying ? pause : play}
        className="rounded p-1 text-cyan-400 transition-colors hover:bg-white/10 hover:text-cyan-300"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>

      <button
        onClick={stepForward}
        className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Next frame"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <span className="ml-1 font-mono text-xs tabular-nums text-cyan-400">{timeDisplay}</span>
      <span className="ml-0.5 mr-1 text-[10px] text-white/40">
        {frameIndex + 1}/{frameCount}
      </span>
    </div>
  );
}
