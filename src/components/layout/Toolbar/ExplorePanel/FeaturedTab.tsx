import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { getFeaturedAirportsByCategory } from '@/components/layout/Toolbar/ExplorePanel/featured';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { FeaturedCategory } from '@/types/featured';
import type { FeaturedTabProps } from './types';

const CATEGORIES: Array<FeaturedCategory | 'all'> = [
  'all',
  'challenging',
  'scenic',
  'unique',
  'historic',
];

export function FeaturedTab({ category, onCategoryChange, onSelectAirport }: FeaturedTabProps) {
  const { t } = useTranslation();
  const airports = getFeaturedAirportsByCategory(category);

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={category}
        onValueChange={(v) => {
          if (v) onCategoryChange(v as FeaturedCategory | 'all');
        }}
        className="flex flex-wrap gap-2"
      >
        {CATEGORIES.map((cat) => (
          <ToggleGroupItem key={cat} value={cat} className="h-auto rounded-full px-3 py-1 text-sm">
            {cat === 'all' ? t('explore.featured.all') : t(`explore.featured.${cat}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid gap-1">
        {airports.map((airport) => (
          <button
            key={airport.icao}
            onClick={() => onSelectAirport(airport.icao)}
            className="flex min-w-0 items-center gap-2 overflow-hidden rounded bg-muted/30 px-2.5 py-2 text-left transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className="xp-value shrink-0 text-info">{airport.icao}</span>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{airport.tagline}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {airport.description}
              </span>
            </div>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
          </button>
        ))}
      </div>
    </div>
  );
}
