import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  CloudRain,
  Compass,
  FileUp,
  Locate,
  MapPin,
  Navigation,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/helpers';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useNavDataCounts, usePlaneState } from '@/queries';
import { useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { useMapStore } from '@/stores/mapStore';
import type { NavLayerVisibility } from '@/types/layers';

interface ToolbarProps {
  airports: Airport[];
  onSelectAirport: (airport: Airport) => void;
  onToggleVatsim: () => void;
  onTogglePlaneTracker: () => void;
  onToggleWeatherRadar: () => void;
  weatherRadarControls: WeatherRadarControls;
  onNavToggle: (layer: keyof NavLayerVisibility) => void;
}

export default function Toolbar({
  airports,
  onSelectAirport,
  onToggleVatsim,
  onTogglePlaneTracker,
  onToggleWeatherRadar,
  weatherRadarControls,
  onNavToggle,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addonManagerOpen, setAddonManagerOpen] = useState(false);
  const [simbriefOpen, setSimbriefOpen] = useState(false);
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
  const showPlaneTracker = useMapStore((s) => s.showPlaneTracker);
  const navVisibility = useMapStore((s) => s.navVisibility);
  const weatherRadarEnabled = useMapStore((s) => s.weatherRadarEnabled);
  const exploreOpen = useMapStore((s) => s.explore.isOpen);
  const setExploreOpen = useMapStore((s) => s.setExploreOpen);
  const airportFilters = useMapStore((s) => s.airportFilters);
  const setAirportFilters = useMapStore((s) => s.setAirportFilters);
  const resetAirportFilters = useMapStore((s) => s.resetAirportFilters);
  const filtersActive = isAirportFiltersActive(airportFilters);

  // Flight plan store
  const loadFMSFile = useFlightPlanStore((s) => s.loadFMSFile);
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);

  // Queries
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const vatsimPilotCount = vatsimData?.pilots?.length;
  const { connected: isXPlaneConnected } = usePlaneState();

  // Nav data counts - derived from airport location
  // Use airport coords from airports array, fallback to metadata
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

  const filteredAirports = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toUpperCase();

    // Filter matching airports
    const matches = airports.filter(
      (a) => a.icao.toUpperCase().includes(query) || a.name.toUpperCase().includes(query)
    );

    // Sort by relevance: exact ICAO > ICAO starts with > ICAO contains > name contains
    matches.sort((a, b) => {
      const aIcao = a.icao.toUpperCase();
      const bIcao = b.icao.toUpperCase();

      // Exact ICAO match first
      if (aIcao === query && bIcao !== query) return -1;
      if (bIcao === query && aIcao !== query) return 1;

      // ICAO starts with query
      const aStartsWith = aIcao.startsWith(query);
      const bStartsWith = bIcao.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (bStartsWith && !aStartsWith) return 1;

      // ICAO contains query
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
              <span className="text-sm font-medium">{t('toolbar.addons')}</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-500">
                Alpha
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tooltips.addons')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Load Flight Plan */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleLoadFlightPlan}
              className={cn(
                'h-9 gap-2 px-3',
                fmsData && !simbriefData && 'border-info/50 text-info'
              )}
            >
              <FileUp className="h-4 w-4" />
              <span className="text-sm font-medium">{t('toolbar.loadPlan')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tooltips.loadPlan')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* SimBrief */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setSimbriefOpen(true)}
              className={cn('h-9 gap-2 px-3', simbriefData && 'border-info/50 text-info')}
            >
              <CloudDownload className="h-4 w-4" />
              <span className="text-sm font-medium">SimBrief</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toolbar.tooltips.simbrief', 'Import flight plan from SimBrief')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Explore Toggle */}
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

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Airport Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 gap-2 px-3',
                filtersActive && 'border-amber-500/50 text-amber-500'
              )}
            >
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">{t('airportFilters.title')}</span>
              {filtersActive && <span className="h-2 w-2 rounded-full bg-amber-500" />}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
              {t('airportFilters.type')}
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

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
              {t('airportFilters.showOnly')}
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={airportFilters.onlyCustom}
              onCheckedChange={() => setAirportFilters({ onlyCustom: !airportFilters.onlyCustom })}
            >
              {t('airportFilters.customOnly')}
            </DropdownMenuCheckboxItem>

            {filtersActive && (
              <>
                <DropdownMenuSeparator />
                <button
                  onClick={resetAirportFilters}
                  className="w-full px-2 py-1.5 text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  {t('airportFilters.reset')}
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 gap-2 px-3',
                totalNavItems > 0 && 'border-primary/50 text-primary'
              )}
            >
              <Navigation className="h-4 w-4" />
              <span className="text-sm font-medium">{t('toolbar.nav')}</span>
              {totalNavItems > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0.5">
                  {totalNavItems}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
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
                <span className="ml-2 font-mono text-xs text-muted-foreground">{layer.count}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
                  className={cn(
                    'h-4 w-4',
                    showPlaneTracker && isXPlaneConnected && 'animate-pulse'
                  )}
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

        <WeatherRadarButton
          enabled={weatherRadarEnabled}
          controls={weatherRadarControls}
          onToggle={onToggleWeatherRadar}
          label={t('toolbar.weather')}
          tooltip={t('toolbar.tooltips.weather')}
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={onToggleVatsim}
                className={cn('h-9 gap-2 px-3', vatsimEnabled && 'border-success/50 text-success')}
              >
                <Radar className={cn('h-4 w-4', vatsimEnabled && 'animate-pulse')} />
                <span className="text-sm font-medium">{t('toolbar.vatsim')}</span>
                {vatsimEnabled && vatsimPilotCount !== undefined && (
                  <Badge className="bg-success/20 px-1.5 py-0.5 text-success">
                    {vatsimPilotCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('toolbar.tooltips.vatsim')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

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

      {/* Addon Manager Dialog */}
      <AddonManager open={addonManagerOpen} onClose={() => setAddonManagerOpen(false)} />

      {/* SimBrief Dialog */}
      <SimbriefDialog open={simbriefOpen} onClose={() => setSimbriefOpen(false)} />
    </div>
  );
}

/* ---------- Weather radar inline button with expandable playback controls ---------- */

function WeatherRadarButton({
  enabled,
  controls,
  onToggle,
  label,
  tooltip,
}: {
  enabled: boolean;
  controls: WeatherRadarControls;
  onToggle: () => void;
  label: string;
  tooltip: string;
}) {
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

  const showControls = enabled && frameCount > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex h-9 items-center overflow-hidden rounded-md border transition-all duration-300',
              enabled
                ? 'border-cyan-500/50 bg-cyan-500/10'
                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {/* Toggle button */}
            <button
              onClick={onToggle}
              className={cn(
                'flex h-full items-center gap-2 px-3 transition-colors',
                enabled ? 'text-cyan-400' : 'text-foreground'
              )}
            >
              <CloudRain className={cn('h-4 w-4', enabled && 'animate-pulse')} />
              <span className="text-sm font-medium">{label}</span>
            </button>

            {/* Playback controls — slide in from right */}
            {showControls && (
              <div className="flex items-center gap-0.5 border-l border-cyan-500/30 px-1.5 duration-200 animate-in fade-in slide-in-from-left-2">
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

                <span className="ml-1 font-mono text-xs tabular-nums text-cyan-400">
                  {timeDisplay}
                </span>
                <span className="ml-0.5 mr-1 text-[10px] text-white/40">
                  {frameIndex + 1}/{frameCount}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
