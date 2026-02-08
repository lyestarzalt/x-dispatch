import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Navigation,
  Plane,
  Radar,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Airport } from '@/lib/xplaneData';
import { useMapStore } from '@/stores/mapStore';
import { AirwaysMode, NavLayerVisibility } from '@/types/layers';

interface ToolbarProps {
  airports: Airport[];
  onSelectAirport: (airport: Airport) => void;
  onOpenSettings: () => void;
  onToggleVatsim: () => void;
  onOpenLauncher: () => void;
  isVatsimEnabled: boolean;
  vatsimPilotCount?: number;
  hasStartPosition: boolean;
  navVisibility: NavLayerVisibility;
  onNavToggle: (layer: keyof NavLayerVisibility) => void;
  onSetAirwaysMode: (mode: AirwaysMode) => void;
  navDataCounts: {
    vors: number;
    ndbs: number;
    dmes: number;
    ils: number;
    waypoints: number;
    airspaces: number;
    highAirways: number;
    lowAirways: number;
  };
}

export default function Toolbar({
  airports,
  onSelectAirport,
  onOpenSettings,
  onToggleVatsim,
  onOpenLauncher,
  isVatsimEnabled,
  vatsimPilotCount,
  hasStartPosition,
  navVisibility,
  onNavToggle,
  onSetAirwaysMode,
  navDataCounts,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const exploreOpen = useMapStore((s) => s.explore.isOpen);
  const setExploreOpen = useMapStore((s) => s.setExploreOpen);

  const filteredAirports = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toUpperCase();
    return airports
      .filter((a) => a.icao.toUpperCase().includes(query) || a.name.toUpperCase().includes(query))
      .slice(0, 8);
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

  const totalNavItems =
    navDataCounts.vors +
    navDataCounts.ndbs +
    navDataCounts.dmes +
    navDataCounts.ils +
    navDataCounts.waypoints +
    navDataCounts.airspaces +
    navDataCounts.highAirways +
    navDataCounts.lowAirways;

  const localNavLayers: { key: keyof NavLayerVisibility; labelKey: string; count: number }[] = [
    { key: 'vors', labelKey: 'layers.items.vors', count: navDataCounts.vors },
    { key: 'ndbs', labelKey: 'layers.items.ndbs', count: navDataCounts.ndbs },
    { key: 'dmes', labelKey: 'layers.items.dmes', count: navDataCounts.dmes },
    { key: 'ils', labelKey: 'layers.items.ils', count: navDataCounts.ils },
    { key: 'waypoints', labelKey: 'layers.items.waypoints', count: navDataCounts.waypoints },
    { key: 'airspaces', labelKey: 'layers.navigation.airspaces', count: navDataCounts.airspaces },
  ];

  return (
    <div className="absolute left-4 right-4 top-4 z-50">
      <div className="relative flex items-center gap-3">
        {/* Search */}
        <div ref={containerRef} className="relative">
          <div className="flex h-10 w-[300px] items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-1 focus-within:ring-ring">
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

        {/* Explore Toggle */}
        <button
          onClick={() => setExploreOpen(!exploreOpen)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-card transition-colors hover:bg-accent',
            exploreOpen && 'border-primary/50 bg-primary/10'
          )}
          aria-label={exploreOpen ? t('explore.close') : t('explore.title')}
          aria-expanded={exploreOpen}
          aria-controls="explore-panel"
        >
          {exploreOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-10 gap-2 px-3',
                  totalNavItems > 0 && 'border-primary/50 text-primary'
                )}
              >
                <Navigation className="h-4 w-4" />
                <span className="text-xs font-medium">{t('toolbar.nav')}</span>
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
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {layer.count}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                Global Airways
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={navVisibility.airwaysMode}
                onValueChange={(value) => onSetAirwaysMode(value as AirwaysMode)}
              >
                <DropdownMenuRadioItem value="off">
                  {t('layers.items.airwaysOff')}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="high">
                  <span className="flex-1">{t('layers.items.highAirways')}</span>
                  {navDataCounts.highAirways > 0 && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {navDataCounts.highAirways}
                    </span>
                  )}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="low">
                  <span className="flex-1">{t('layers.items.lowAirways')}</span>
                  {navDataCounts.lowAirways > 0 && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {navDataCounts.lowAirways}
                    </span>
                  )}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={onToggleVatsim}
            className={cn('h-10 gap-2 px-3', isVatsimEnabled && 'border-success/50 text-success')}
          >
            <Radar className={cn('h-4 w-4', isVatsimEnabled && 'animate-pulse')} />
            <span className="text-xs font-medium">{t('toolbar.vatsim')}</span>
            {isVatsimEnabled && vatsimPilotCount !== undefined && (
              <Badge className="bg-success/20 px-1.5 py-0.5 text-success">{vatsimPilotCount}</Badge>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={onOpenLauncher}
            className={cn('h-10 gap-2 px-3', hasStartPosition && 'border-success/50 text-success')}
          >
            <Plane className="h-4 w-4" />
            <span className="text-xs font-medium">{t('toolbar.launch')}</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            className="h-10 w-10"
            aria-label={t('settings.title')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
