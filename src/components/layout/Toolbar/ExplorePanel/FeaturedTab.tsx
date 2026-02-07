import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { type FeaturedCategory, getFeaturedAirportsByCategory } from '@/data';
import { cn } from '@/lib/utils';
import type { FeaturedTabProps } from './types';

const CATEGORIES: Array<FeaturedCategory | 'all'> = [
  'all',
  'challenging',
  'scenic',
  'unique',
  'historic',
];

const CATEGORY_ICONS: Record<FeaturedCategory, string> = {
  challenging: 'mountain',
  scenic: 'sunrise',
  unique: 'sparkles',
  historic: 'landmark',
};

export function FeaturedTab({ category, onCategoryChange, onSelectAirport }: FeaturedTabProps) {
  const { t } = useTranslation();
  const airports = getFeaturedAirportsByCategory(category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              category === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {cat === 'all' ? t('explore.featured.all') : t(`explore.featured.${cat}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        {airports.map((airport) => (
          <button
            key={airport.icao}
            onClick={() => onSelectAirport(airport.icao)}
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
          >
            <span className="text-lg">
              {t(`explore.featured.icons.${CATEGORY_ICONS[airport.category]}`)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{airport.icao}</span>
                <span className="truncate text-sm text-muted-foreground">{airport.tagline}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {airport.description}
              </p>
            </div>
            <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
