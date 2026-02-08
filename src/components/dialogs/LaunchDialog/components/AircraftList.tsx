import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plane, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Aircraft,
  AircraftType,
  EngineType,
  getAircraftType,
  getCategory,
  getEngineType,
} from '../types';

interface AircraftListProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  isScanning: boolean;
  searchQuery: string;
  filterCategory: string;
  filterManufacturer: string;
  filterAircraftType: AircraftType;
  filterEngineType: EngineType;
  showFavoritesOnly: boolean;
  favorites: string[];
  aircraftImages: Record<string, string>;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onManufacturerChange: (manufacturer: string) => void;
  onAircraftTypeChange: (type: AircraftType) => void;
  onEngineTypeChange: (type: EngineType) => void;
  onToggleFavoritesOnly: () => void;
  onSelectAircraft: (aircraft: Aircraft) => void;
  onToggleFavorite: (path: string) => void;
}

export function AircraftList({
  aircraft,
  selectedAircraft,
  isScanning,
  searchQuery,
  filterCategory,
  filterManufacturer,
  filterAircraftType,
  filterEngineType,
  showFavoritesOnly,
  favorites,
  aircraftImages,
  onSearchChange,
  onCategoryChange,
  onManufacturerChange,
  onAircraftTypeChange,
  onEngineTypeChange,
  onToggleFavoritesOnly,
  onSelectAircraft,
  onToggleFavorite,
}: AircraftListProps) {
  const { t } = useTranslation();

  const manufacturers = useMemo(() => {
    const set = new Set(aircraft.map((ac) => ac.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [aircraft]);

  const categories = useMemo(() => {
    const set = new Set(aircraft.map((ac) => getCategory(ac.path)));
    return Array.from(set).sort();
  }, [aircraft]);

  const filteredAircraft = useMemo(() => {
    let result = aircraft;

    if (showFavoritesOnly) {
      result = result.filter((ac) => favorites.includes(ac.path));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ac) =>
          ac.name.toLowerCase().includes(q) ||
          ac.manufacturer.toLowerCase().includes(q) ||
          ac.icao.toLowerCase().includes(q)
      );
    }

    if (filterManufacturer !== 'all') {
      result = result.filter((ac) => ac.manufacturer === filterManufacturer);
    }

    if (filterCategory !== 'all') {
      result = result.filter((ac) => getCategory(ac.path) === filterCategory);
    }

    if (filterAircraftType !== 'all') {
      result = result.filter((ac) => getAircraftType(ac) === filterAircraftType);
    }

    if (filterEngineType !== 'all') {
      result = result.filter((ac) => getEngineType(ac) === filterEngineType);
    }

    return result.sort((a, b) => {
      const aFav = favorites.includes(a.path);
      const bFav = favorites.includes(b.path);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    aircraft,
    searchQuery,
    filterManufacturer,
    filterCategory,
    filterAircraftType,
    filterEngineType,
    favorites,
    showFavoritesOnly,
  ]);

  return (
    <div className="flex w-[320px] min-w-[280px] flex-col border-r border-border bg-card lg:w-[360px]">
      {/* Section Header - X-Plane style */}
      <div className="flex-shrink-0 border-b border-border px-3 py-2">
        <h3 className="xp-section-heading mb-0 border-0 pb-0">{t('launcher.aircraft.title')}</h3>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 space-y-2 border-b border-border p-2">
        {/* Search Row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder={t('launcher.aircraft.search')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 rounded-lg bg-secondary pr-8 text-sm"
            />
            <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onToggleFavoritesOnly}
            aria-label={
              showFavoritesOnly
                ? t('launcher.aircraft.showAll')
                : t('launcher.aircraft.showFavoritesOnly')
            }
            aria-pressed={showFavoritesOnly}
          >
            <Star className={cn('h-3.5 w-3.5', showFavoritesOnly && 'fill-current')} />
          </Button>
        </div>

        {/* Filter Dropdowns - Row 1: Type & Engine */}
        <div className="flex gap-2">
          <Select value={filterAircraftType} onValueChange={onAircraftTypeChange}>
            <SelectTrigger className="h-7 flex-1 rounded-lg bg-secondary text-xs">
              <SelectValue placeholder={t('launcher.aircraft.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('launcher.aircraft.allTypes')}</SelectItem>
              <SelectItem value="fixed-wing">{t('launcher.aircraft.fixedWing')}</SelectItem>
              <SelectItem value="helicopter">{t('launcher.aircraft.helicopter')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEngineType} onValueChange={onEngineTypeChange}>
            <SelectTrigger className="h-7 flex-1 rounded-lg bg-secondary text-xs">
              <SelectValue placeholder={t('launcher.aircraft.allEngines')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('launcher.aircraft.allEngines')}</SelectItem>
              <SelectItem value="jet">{t('launcher.aircraft.jet')}</SelectItem>
              <SelectItem value="prop">{t('launcher.aircraft.prop')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Dropdowns - Row 2: Category & Manufacturer */}
        <div className="flex gap-2">
          <Select value={filterCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="h-7 flex-1 rounded-lg bg-secondary text-xs">
              <SelectValue placeholder={t('launcher.aircraft.allCategories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('launcher.aircraft.allCategories')}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterManufacturer} onValueChange={onManufacturerChange}>
            <SelectTrigger className="h-7 flex-1 rounded-lg bg-secondary text-xs">
              <SelectValue placeholder={t('launcher.aircraft.allManufacturers')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('launcher.aircraft.allManufacturers')}</SelectItem>
              {manufacturers.map((mfg) => (
                <SelectItem key={mfg} value={mfg}>
                  {mfg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Count */}
        <div className="text-xs text-muted-foreground">
          {t('launcher.aircraft.count', { count: filteredAircraft.length })}
          {showFavoritesOnly &&
            ` · ${t('launcher.aircraft.favorites', { count: favorites.length })}`}
        </div>
      </div>

      {/* Aircraft List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isScanning ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredAircraft.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {showFavoritesOnly
                ? t('launcher.aircraft.noFavorites')
                : t('launcher.aircraft.noAircraft')}
            </div>
          ) : (
            filteredAircraft.map((ac) => {
              const isSelected = selectedAircraft?.path === ac.path;
              const isFavorite = favorites.includes(ac.path);

              return (
                <div
                  key={ac.path}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectAircraft(ac)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectAircraft(ac);
                    }
                  }}
                  title={`${ac.name} - ${ac.manufacturer}`}
                  className={cn(
                    'group relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isSelected
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'bg-secondary hover:bg-accent'
                  )}
                >
                  {/* Aircraft Thumbnail */}
                  <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                    {aircraftImages[ac.path] ? (
                      <img
                        src={aircraftImages[ac.path]}
                        alt={ac.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Plane className="h-5 w-5 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>

                  {/* Aircraft Info */}
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'truncate text-sm font-medium',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {ac.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{ac.manufacturer}</div>
                  </div>

                  {/* Favorite Button */}
                  <button
                    type="button"
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      isFavorite
                        ? 'text-warning'
                        : 'text-muted-foreground/30 hover:text-muted-foreground'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(ac.path);
                    }}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
