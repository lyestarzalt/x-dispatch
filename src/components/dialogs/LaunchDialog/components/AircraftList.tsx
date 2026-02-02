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
import { Aircraft, getCategory } from '../types';

interface AircraftListProps {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  isScanning: boolean;
  searchQuery: string;
  filterCategory: string;
  filterManufacturer: string;
  showFavoritesOnly: boolean;
  favorites: string[];
  aircraftImages: Record<string, string>;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onManufacturerChange: (manufacturer: string) => void;
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
  showFavoritesOnly,
  favorites,
  aircraftImages,
  onSearchChange,
  onCategoryChange,
  onManufacturerChange,
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
        (ac) => ac.name.toLowerCase().includes(q) || ac.manufacturer.toLowerCase().includes(q)
      );
    }

    if (filterManufacturer !== 'all') {
      result = result.filter((ac) => ac.manufacturer === filterManufacturer);
    }

    if (filterCategory !== 'all') {
      result = result.filter((ac) => getCategory(ac.path) === filterCategory);
    }

    return result.sort((a, b) => {
      const aFav = favorites.includes(a.path);
      const bFav = favorites.includes(b.path);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [aircraft, searchQuery, filterManufacturer, filterCategory, favorites, showFavoritesOnly]);

  return (
    <div className="flex w-[420px] flex-col border-r">
      {/* Filters */}
      <div className="flex-shrink-0 space-y-2 border-b bg-muted/20 p-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('launcher.aircraft.search')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onToggleFavoritesOnly}
            title={
              showFavoritesOnly
                ? t('launcher.aircraft.showAll')
                : t('launcher.aircraft.showFavoritesOnly')
            }
          >
            <Star className={cn('h-3.5 w-3.5', showFavoritesOnly && 'fill-current')} />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={filterCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="h-7 flex-1 text-xs">
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
            <SelectTrigger className="h-7 flex-1 text-xs">
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
        <div className="text-[10px] text-muted-foreground">
          {t('launcher.aircraft.count', { count: filteredAircraft.length })}
          {showFavoritesOnly &&
            ` · ${t('launcher.aircraft.favorites', { count: favorites.length })}`}
        </div>
      </div>

      {/* Aircraft list */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isScanning ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAircraft.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {showFavoritesOnly
                ? t('launcher.aircraft.noFavorites')
                : t('launcher.aircraft.noAircraft')}
            </div>
          ) : (
            filteredAircraft.map((ac) => (
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
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded p-1.5 text-left transition-colors',
                  selectedAircraft?.path === ac.path
                    ? 'bg-primary/10 ring-1 ring-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="h-10 w-14 flex-shrink-0 overflow-hidden rounded bg-muted/30">
                  {aircraftImages[ac.path] ? (
                    <img
                      src={aircraftImages[ac.path]}
                      alt={ac.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Plane className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{ac.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {ac.manufacturer}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(ac.path);
                  }}
                  className="rounded p-1 hover:bg-muted"
                >
                  <Star
                    className={cn(
                      'h-3 w-3',
                      favorites.includes(ac.path)
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-muted-foreground/50'
                    )}
                  />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
