import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Navigation, Plane, Radar, Search, Settings, X } from 'lucide-react';
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
import { AirwaysMode, NavLayerVisibility } from '@/types/layers';

export interface ToolbarProps {
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
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSelectedIndex(0);

      if (query.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      const upperQuery = query.toUpperCase();
      const results = airports
        .filter(
          (a) =>
            a.icao.toUpperCase().includes(upperQuery) || a.name.toUpperCase().includes(upperQuery)
        )
        .slice(0, 8);

      setSearchResults(results);
      setShowResults(results.length > 0);
    },
    [airports]
  );

  const selectAirport = useCallback(
    (airport: Airport) => {
      setShowResults(false);
      setSearchQuery('');
      setSearchResults([]);
      onSelectAirport(airport);
      inputRef.current?.blur();
    },
    [onSelectAirport]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showResults || searchResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % searchResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectAirport(searchResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    },
    [showResults, searchResults, selectedIndex, selectAirport]
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

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="absolute left-4 right-4 top-4 z-50 flex items-center gap-3">
      <div ref={containerRef} className="relative">
        <div className="flex h-10 min-w-[300px] items-center gap-2 rounded-lg border border-border bg-card/95 px-3 backdrop-blur-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={t('toolbar.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onKeyDown={handleKeyDown}
            className="h-8 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-lg border border-border bg-popover/95 shadow-2xl backdrop-blur-sm">
            {searchResults.map((airport, index) => (
              <button
                key={airport.icao}
                onClick={() => selectAirport(airport)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <span className="w-12 font-mono text-sm font-medium text-primary">
                  {airport.icao}
                </span>
                <span className="truncate text-sm text-muted-foreground">{airport.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs">{totalNavItems}</span>
              )}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
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
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
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
            <span className="rounded bg-success/20 px-1.5 py-0.5 text-xs">{vatsimPilotCount}</span>
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
          title={t('settings.title')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
