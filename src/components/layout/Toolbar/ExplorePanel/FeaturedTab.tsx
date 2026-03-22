import { useTranslation } from 'react-i18next';
import { getFeaturedAirportsByCategory } from '@/components/layout/Toolbar/ExplorePanel/featured';
import { Badge } from '@/components/ui/badge';
import type { FeaturedCategory } from '@/types/featured';
import type { FeaturedTabProps } from './types';

const CATEGORIES: Array<FeaturedCategory | 'all'> = [
  'all',
  'challenging',
  'scenic',
  'unique',
  'historic',
];

const CATEGORY_VARIANTS: Record<
  string,
  NonNullable<React.ComponentProps<typeof Badge>['variant']>
> = {
  all: 'default',
  challenging: 'danger',
  scenic: 'cat-emerald',
  unique: 'cat-amber',
  historic: 'cat-sky',
};

export function FeaturedTab({ category, onCategoryChange, onSelectAirport }: FeaturedTabProps) {
  const { t } = useTranslation();
  const airports = getFeaturedAirportsByCategory(category);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={category === cat ? CATEGORY_VARIANTS[cat] : 'secondary'}
            className="cursor-pointer text-xs"
            onClick={() => onCategoryChange(cat as FeaturedCategory | 'all')}
          >
            {cat === 'all' ? t('explore.featured.all') : t(`explore.featured.${cat}`)}
          </Badge>
        ))}
      </div>

      <div className="space-y-0.5">
        {airports.map((airport) => (
          <button
            key={airport.icao}
            onClick={() => onSelectAirport(airport.icao)}
            className="group flex w-full min-w-0 items-baseline gap-2.5 overflow-hidden rounded px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
          >
            <span className="shrink-0 font-mono text-sm font-semibold text-info">
              {airport.icao}
            </span>
            <div className="min-w-0 flex-1">
              <span className="xp-label truncate text-foreground group-hover:text-foreground">
                {airport.tagline}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
