import { useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils/helpers';
import { useAircraftImage } from '@/queries';
import { useLaunchStore } from '@/stores/launchStore';
import type { Aircraft } from '@/types/aircraft';
import {
  type AircraftType,
  type EngineType,
  getAircraftType,
  getCategory,
  getEngineType,
} from '../types';

interface AircraftListProps {
  aircraftList: Aircraft[];
  isScanning: boolean;
}

// Individual list item - uses TanStack Query for image loading
function AircraftListItem({
  aircraft,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  aircraft: Aircraft;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const { data: imageUrl } = useAircraftImage(aircraft.previewImage);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      title={`${aircraft.name} - ${aircraft.manufacturer}`}
      className={cn(
        'group relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'bg-secondary hover:bg-accent'
      )}
    >
      {/* Aircraft Thumbnail */}
      <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={aircraft.name} className="h-full w-full object-contain" />
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
          {aircraft.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">{aircraft.manufacturer}</div>
      </div>

      {/* Favorite Button */}
      <button
        type="button"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
          isFavorite ? 'text-warning' : 'text-muted-foreground/30 hover:text-muted-foreground'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
      </button>
    </div>
  );
}

export function AircraftList({ aircraftList, isScanning }: AircraftListProps) {
  const { t } = useTranslation();

  // Local filter state (only this component uses it)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterManufacturer, setFilterManufacturer] = useState('all');
  const [filterAircraftType, setFilterAircraftType] = useState<AircraftType>('all');
  const [filterEngineType, setFilterEngineType] = useState<EngineType>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Shared state from Zustand
  const selectedAircraft = useLaunchStore((s) => s.selectedAircraft);
  const favorites = useLaunchStore((s) => s.favorites);
  const selectAircraft = useLaunchStore((s) => s.selectAircraft);
  const toggleFavorite = useLaunchStore((s) => s.toggleFavorite);

  const manufacturers = useMemo(() => {
    const set = new Set(aircraftList.map((ac) => ac.manufacturer).filter(Boolean));
    return Array.from(set).sort();
  }, [aircraftList]);

  const categories = useMemo(() => {
    const set = new Set(aircraftList.map((ac) => getCategory(ac.path)));
    return Array.from(set).sort();
  }, [aircraftList]);

  const filteredAircraft = useMemo(() => {
    let result = aircraftList;

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
    aircraftList,
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
      {/* Section Header */}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-lg bg-secondary pr-8 text-sm"
            />
            <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
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
          <Select
            value={filterAircraftType}
            onValueChange={(v) => setFilterAircraftType(v as AircraftType)}
          >
            <SelectTrigger className="h-7 flex-1 rounded-lg bg-secondary text-xs">
              <SelectValue placeholder={t('launcher.aircraft.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('launcher.aircraft.allTypes')}</SelectItem>
              <SelectItem value="fixed-wing">{t('launcher.aircraft.fixedWing')}</SelectItem>
              <SelectItem value="helicopter">{t('launcher.aircraft.helicopter')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterEngineType}
            onValueChange={(v) => setFilterEngineType(v as EngineType)}
          >
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
          <Select value={filterCategory} onValueChange={setFilterCategory}>
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
          <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
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
            filteredAircraft.map((ac) => (
              <AircraftListItem
                key={ac.path}
                aircraft={ac}
                isSelected={selectedAircraft?.path === ac.path}
                isFavorite={favorites.includes(ac.path)}
                onSelect={() => selectAircraft(ac)}
                onToggleFavorite={() => toggleFavorite(ac.path)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
