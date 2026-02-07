# Explore Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an expandable search panel with airport filtering, curated featured airports with stories, and popular route visualization.

**Architecture:** Expandable panel below toolbar search bar with 3 tabs (Filters, Featured, Routes). Static curated data files for featured airports/routes. New MapLibre layers for featured markers and route lines. Integration with mapStore for state.

**Tech Stack:** React, TypeScript, Tailwind CSS, MapLibre GL JS, Zustand

---

## Task 1: Add Curated Data Types

**Files:**

- Create: `src/data/types.ts`

**Step 1: Create types file**

```typescript
// src/data/types.ts

export type FeaturedCategory = 'challenging' | 'scenic' | 'unique' | 'historic';

export interface FeaturedAirport {
  icao: string;
  category: FeaturedCategory;
  tagline: string;
  description: string;
}

export interface FeaturedRoute {
  from: string;
  to: string;
  name: string;
  description: string;
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat(explore): add types for featured airports and routes"
```

---

## Task 2: Add Featured Airports Data

**Files:**

- Create: `src/data/featuredAirports.ts`

**Step 1: Create featured airports file**

```typescript
// src/data/featuredAirports.ts
import type { FeaturedAirport } from './types';

export const FEATURED_AIRPORTS: FeaturedAirport[] = [
  // Challenging
  {
    icao: 'VNLK',
    category: 'challenging',
    tagline: "World's most dangerous airport",
    description:
      'Tenzing-Hillary Airport sits at 9,383 ft in the Himalayas with a 527m runway ending in a cliff. Only specially certified pilots can land here.',
  },
  {
    icao: 'LOWI',
    category: 'challenging',
    tagline: 'Valley approach through the Alps',
    description:
      'Innsbruck requires a precise curved approach through a narrow valley surrounded by mountains up to 8,000 ft.',
  },
  {
    icao: 'VQPR',
    category: 'challenging',
    tagline: 'Himalayan zigzag approach',
    description:
      'Paro is one of the most difficult airports in the world. Pilots must navigate steep mountain terrain with only visual approaches allowed.',
  },
  {
    icao: 'LPMA',
    category: 'challenging',
    tagline: 'Columns over the Atlantic',
    description:
      'Madeira Airport features a runway extended on massive columns over the ocean. Strong crosswinds make landings challenging.',
  },
  {
    icao: 'SBRJ',
    category: 'challenging',
    tagline: 'City center, short runway',
    description:
      'Santos Dumont sits in downtown Rio with a 1,323m runway between Sugarloaf Mountain and the bay. Tight approaches over the city.',
  },
  {
    icao: 'LFLJ',
    category: 'challenging',
    tagline: 'The ski slope runway',
    description:
      'Courchevel has an 18.5% gradient runway - one of the steepest in the world. Aircraft take off downhill and land uphill.',
  },
  {
    icao: 'EKVG',
    category: 'challenging',
    tagline: 'North Atlantic crosswinds',
    description:
      'Vágar in the Faroe Islands features extreme weather, a short runway, and terrain on all sides in the middle of the North Atlantic.',
  },
  {
    icao: 'SPZO',
    category: 'challenging',
    tagline: 'High altitude Andes',
    description:
      'Cusco sits at 10,860 ft elevation in the Peruvian Andes. Thin air affects aircraft performance significantly.',
  },

  // Scenic
  {
    icao: 'NZQN',
    category: 'scenic',
    tagline: 'Mountains meet the lake',
    description:
      'Queenstown offers stunning views of the Remarkables mountain range and Lake Wakatipu. A bucket-list destination for pilots.',
  },
  {
    icao: 'NZMF',
    category: 'scenic',
    tagline: 'Fjord landing',
    description:
      'Milford Sound airstrip sits in a glacial valley surrounded by sheer cliffs and waterfalls. Purely VFR, weather-dependent.',
  },
  {
    icao: 'FSIA',
    category: 'scenic',
    tagline: 'Tropical paradise',
    description:
      'Seychelles International offers approaches over turquoise waters and pristine beaches with granite island peaks.',
  },
  {
    icao: 'VRMM',
    category: 'scenic',
    tagline: 'Overwater approach',
    description:
      'Malé in the Maldives features a runway built on a separate island. Approach over crystal-clear lagoons and coral reefs.',
  },
  {
    icao: 'NTAA',
    category: 'scenic',
    tagline: 'Pacific island paradise',
    description:
      "Faa'a International in Tahiti offers views of Moorea's volcanic peaks across the lagoon during approach.",
  },
  {
    icao: 'FMEE',
    category: 'scenic',
    tagline: 'Volcanic island approach',
    description:
      'Roland Garros on Réunion Island offers dramatic views of Piton de la Fournaise, one of the most active volcanoes.',
  },
  {
    icao: 'KSEZ',
    category: 'scenic',
    tagline: 'Red rock desert',
    description:
      "Sedona sits among Arizona's famous red rock formations. The approach through Oak Creek Canyon is unforgettable.",
  },
  {
    icao: 'ENSB',
    category: 'scenic',
    tagline: 'Arctic wilderness',
    description:
      'Svalbard Airport is one of the northernmost in the world. Approach over glaciers, fjords, and polar wilderness.',
  },

  // Unique
  {
    icao: 'LXGB',
    category: 'unique',
    tagline: 'Road crosses the runway',
    description:
      "Gibraltar's runway is intersected by the main road into Spain. Traffic stops for every aircraft movement.",
  },
  {
    icao: 'EGHE',
    category: 'unique',
    tagline: 'Beach runway',
    description:
      'Barra in Scotland uses the beach as its runway - the only scheduled beach airport in the world. Tide-dependent operations.',
  },
  {
    icao: 'RJTT',
    category: 'unique',
    tagline: 'City island at night',
    description:
      'Haneda sits on reclaimed land in Tokyo Bay. Night approaches offer spectacular views of the illuminated city skyline.',
  },
  {
    icao: 'KSAN',
    category: 'unique',
    tagline: 'Downtown approach',
    description:
      'San Diego Lindbergh Field has one of the most urban approaches - descending between skyscrapers before touchdown.',
  },
  {
    icao: 'EGLC',
    category: 'unique',
    tagline: 'Steep city center approach',
    description:
      'London City requires a steep 5.5° approach over the Thames, threading between Canary Wharf towers.',
  },
  {
    icao: 'VMMC',
    category: 'unique',
    tagline: 'Casino skyline',
    description:
      'Macau features a curved approach over the Pearl River Delta with casino towers on the horizon.',
  },

  // Historic
  {
    icao: 'EDDT',
    category: 'historic',
    tagline: 'Berlin Airlift legacy',
    description:
      'Tempelhof was the site of the historic Berlin Airlift. Now closed, its iconic terminal remains a monument to Cold War history.',
  },
  {
    icao: 'VHHX',
    category: 'historic',
    tagline: 'The checkerboard turn',
    description:
      'Kai Tak (closed 1998) was famous for its IGS 13 approach requiring a 47° turn at 200 ft. Legendary among pilots.',
  },
  {
    icao: 'LFPB',
    category: 'historic',
    tagline: 'Aviation birthplace',
    description:
      'Le Bourget is where Lindbergh landed after crossing the Atlantic. Home of the Paris Air Show and aerospace museum.',
  },
  {
    icao: 'KOSH',
    category: 'historic',
    tagline: 'EAA AirVenture home',
    description:
      "Wittman Regional hosts the world's largest aviation gathering. During AirVenture, it becomes the busiest airport on Earth.",
  },
];

export function getFeaturedAirportsByCategory(
  category: FeaturedCategory | 'all'
): FeaturedAirport[] {
  if (category === 'all') return FEATURED_AIRPORTS;
  return FEATURED_AIRPORTS.filter((a) => a.category === category);
}

export function getFeaturedAirport(icao: string): FeaturedAirport | undefined {
  return FEATURED_AIRPORTS.find((a) => a.icao === icao);
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/data/featuredAirports.ts
git commit -m "feat(explore): add curated featured airports data"
```

---

## Task 3: Add Featured Routes Data

**Files:**

- Create: `src/data/featuredRoutes.ts`

**Step 1: Create featured routes file**

```typescript
// src/data/featuredRoutes.ts
import type { FeaturedRoute } from './types';

export const FEATURED_ROUTES: FeaturedRoute[] = [
  // Transatlantic
  {
    from: 'KJFK',
    to: 'EGLL',
    name: 'North Atlantic Classic',
    description: 'One of the busiest transatlantic routes connecting New York and London.',
  },
  {
    from: 'LFPG',
    to: 'KJFK',
    name: 'Paris-New York',
    description: 'Iconic route once flown by Concorde. Paris CDG to JFK.',
  },

  // Transpacific
  {
    from: 'KLAX',
    to: 'RJTT',
    name: 'Pacific Crossing',
    description: 'Los Angeles to Tokyo Haneda over the vast Pacific Ocean.',
  },
  {
    from: 'KSFO',
    to: 'VHHH',
    name: 'Gateway to Asia',
    description: 'San Francisco to Hong Kong - a major US-Asia corridor.',
  },

  // Regional Asia
  {
    from: 'WSSS',
    to: 'VHHH',
    name: 'Asian Tiger Route',
    description: 'Singapore to Hong Kong connecting two major financial hubs.',
  },
  {
    from: 'VHHH',
    to: 'RJTT',
    name: 'Far East Express',
    description: 'Hong Kong to Tokyo - heavily traveled business route.',
  },

  // European
  {
    from: 'EGLL',
    to: 'LEMD',
    name: 'London-Madrid',
    description: 'Popular European route between UK and Spanish capitals.',
  },
  {
    from: 'EDDF',
    to: 'LFPG',
    name: 'Rhine-Seine',
    description: 'Frankfurt to Paris connecting German and French hubs.',
  },

  // Scenic
  {
    from: 'NZQN',
    to: 'NZMF',
    name: 'Scenic NZ Hop',
    description: 'Queenstown to Milford Sound through stunning New Zealand fjords.',
  },
  {
    from: 'LOWI',
    to: 'LSZS',
    name: 'Alpine Challenge',
    description: "Innsbruck to Samedan - two of Europe's most challenging mountain airports.",
  },
  {
    from: 'PAKT',
    to: 'PAJN',
    name: 'Alaska Coastal',
    description: 'Ketchikan to Juneau through the Inside Passage.',
  },

  // Middle East
  {
    from: 'OMDB',
    to: 'EGLL',
    name: 'Emirates Classic',
    description: 'Dubai to London - one of the most profitable routes in aviation.',
  },
  {
    from: 'OEJN',
    to: 'VABB',
    name: 'Hajj Route',
    description: 'Jeddah to Mumbai - major pilgrimage and labor corridor.',
  },

  // Americas
  {
    from: 'KMIA',
    to: 'SBGR',
    name: 'Americas Corridor',
    description: 'Miami to São Paulo connecting North and South America.',
  },
  {
    from: 'MMMX',
    to: 'KLAX',
    name: 'Mexico City Express',
    description: 'High-altitude departure from Mexico City to Los Angeles.',
  },

  // Australia
  {
    from: 'YSSY',
    to: 'NZAA',
    name: 'Trans-Tasman',
    description: 'Sydney to Auckland across the Tasman Sea.',
  },
  {
    from: 'YSSY',
    to: 'WSSS',
    name: 'Kangaroo Route Leg',
    description: 'Sydney to Singapore - part of the historic Kangaroo Route to Europe.',
  },
];

export function getFeaturedRoute(from: string, to: string): FeaturedRoute | undefined {
  return FEATURED_ROUTES.find((r) => r.from === from && r.to === to);
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/data/featuredRoutes.ts
git commit -m "feat(explore): add curated featured routes data"
```

---

## Task 4: Add Data Index Export

**Files:**

- Create: `src/data/index.ts`

**Step 1: Create index file**

```typescript
// src/data/index.ts

export * from './types';
export * from './featuredAirports';
export * from './featuredRoutes';
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/data/index.ts
git commit -m "feat(explore): add data index exports"
```

---

## Task 5: Add Explore Store State

**Files:**

- Modify: `src/stores/mapStore.ts`

**Step 1: Read current mapStore**

Read `src/stores/mapStore.ts` to understand the existing structure.

**Step 2: Add explore state to mapStore**

Add to the MapState interface:

```typescript
// Add to MapState interface
explore: {
  isOpen: boolean;
  activeTab: 'filters' | 'featured' | 'routes';
  selectedRoute: { from: string; to: string } | null;
  filters: {
    country: string | null;
    region: string | null;
    type: 'all' | 'land' | 'seaplane' | 'heliport';
    hasIata: boolean;
  };
  featuredCategory: 'all' | 'challenging' | 'scenic' | 'unique' | 'historic';
};
```

Add to default state:

```typescript
explore: {
  isOpen: false,
  activeTab: 'featured',
  selectedRoute: null,
  filters: {
    country: null,
    region: null,
    type: 'all',
    hasIata: false,
  },
  featuredCategory: 'all',
},
```

Add actions:

```typescript
setExploreOpen: (isOpen: boolean) =>
  set((state) => ({ explore: { ...state.explore, isOpen } })),
setExploreTab: (tab: 'filters' | 'featured' | 'routes') =>
  set((state) => ({ explore: { ...state.explore, activeTab: tab } })),
setSelectedRoute: (route: { from: string; to: string } | null) =>
  set((state) => ({ explore: { ...state.explore, selectedRoute: route } })),
setExploreFilters: (filters: Partial<MapState['explore']['filters']>) =>
  set((state) => ({
    explore: { ...state.explore, filters: { ...state.explore.filters, ...filters } },
  })),
setFeaturedCategory: (category: MapState['explore']['featuredCategory']) =>
  set((state) => ({ explore: { ...state.explore, featuredCategory: category } })),
```

**Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/stores/mapStore.ts
git commit -m "feat(explore): add explore state to mapStore"
```

---

## Task 6: Create ExplorePanel Component Structure

**Files:**

- Create: `src/components/layout/Toolbar/ExplorePanel/types.ts`
- Create: `src/components/layout/Toolbar/ExplorePanel/index.tsx`

**Step 1: Create types file**

```typescript
// src/components/layout/Toolbar/ExplorePanel/types.ts
import type { FeaturedAirport, FeaturedCategory, FeaturedRoute } from '@/data';

export interface ExplorePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FiltersTabProps {
  country: string | null;
  region: string | null;
  type: 'all' | 'land' | 'seaplane' | 'heliport';
  hasIata: boolean;
  onCountryChange: (country: string | null) => void;
  onRegionChange: (region: string | null) => void;
  onTypeChange: (type: 'all' | 'land' | 'seaplane' | 'heliport') => void;
  onHasIataChange: (hasIata: boolean) => void;
}

export interface FeaturedTabProps {
  category: FeaturedCategory | 'all';
  onCategoryChange: (category: FeaturedCategory | 'all') => void;
  onSelectAirport: (icao: string) => void;
}

export interface RoutesTabProps {
  selectedRoute: { from: string; to: string } | null;
  onSelectRoute: (route: { from: string; to: string } | null) => void;
}
```

**Step 2: Create main panel component**

```typescript
// src/components/layout/Toolbar/ExplorePanel/index.tsx

import { useTranslation } from 'react-i18next';
import { useMapStore } from '@/stores/mapStore';
import { cn } from '@/lib/utils';
import { FiltersTab } from './FiltersTab';
import { FeaturedTab } from './FeaturedTab';
import { RoutesTab } from './RoutesTab';

const TABS = ['filters', 'featured', 'routes'] as const;

export function ExplorePanel() {
  const { t } = useTranslation();
  const {
    explore,
    setExploreTab,
    setExploreFilters,
    setFeaturedCategory,
    setSelectedRoute,
  } = useMapStore();

  if (!explore.isOpen) return null;

  const handleSelectAirport = (icao: string) => {
    // Will be implemented to fly to airport
    console.log('Select airport:', icao);
  };

  return (
    <div className="absolute left-0 right-0 top-full z-40 border-b border-border bg-card shadow-lg">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setExploreTab(tab)}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              explore.activeTab === tab
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`explore.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-h-80 overflow-y-auto p-4">
        {explore.activeTab === 'filters' && (
          <FiltersTab
            country={explore.filters.country}
            region={explore.filters.region}
            type={explore.filters.type}
            hasIata={explore.filters.hasIata}
            onCountryChange={(country) => setExploreFilters({ country })}
            onRegionChange={(region) => setExploreFilters({ region })}
            onTypeChange={(type) => setExploreFilters({ type })}
            onHasIataChange={(hasIata) => setExploreFilters({ hasIata })}
          />
        )}
        {explore.activeTab === 'featured' && (
          <FeaturedTab
            category={explore.featuredCategory}
            onCategoryChange={setFeaturedCategory}
            onSelectAirport={handleSelectAirport}
          />
        )}
        {explore.activeTab === 'routes' && (
          <RoutesTab
            selectedRoute={explore.selectedRoute}
            onSelectRoute={setSelectedRoute}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify**

Run: `npm run typecheck`
Expected: FAIL (FiltersTab, FeaturedTab, RoutesTab not yet created)

**Step 4: Commit**

```bash
git add src/components/layout/Toolbar/ExplorePanel/
git commit -m "feat(explore): add ExplorePanel component structure"
```

---

## Task 7: Create FiltersTab Component

**Files:**

- Create: `src/components/layout/Toolbar/ExplorePanel/FiltersTab.tsx`

**Step 1: Create FiltersTab**

```typescript
// src/components/layout/Toolbar/ExplorePanel/FiltersTab.tsx

import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { FiltersTabProps } from './types';

// TODO: These will be populated from database queries
const COUNTRIES: string[] = [];
const REGIONS: string[] = [];

export function FiltersTab({
  country,
  region,
  type,
  hasIata,
  onCountryChange,
  onRegionChange,
  onTypeChange,
  onHasIataChange,
}: FiltersTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Country */}
        <div className="space-y-2">
          <Label>{t('explore.filters.country')}</Label>
          <Select
            value={country || 'all'}
            onValueChange={(v) => onCountryChange(v === 'all' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('explore.filters.allCountries')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('explore.filters.allCountries')}</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Region */}
        <div className="space-y-2">
          <Label>{t('explore.filters.region')}</Label>
          <Select
            value={region || 'all'}
            onValueChange={(v) => onRegionChange(v === 'all' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('explore.filters.allRegions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('explore.filters.allRegions')}</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label>{t('explore.filters.type')}</Label>
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('explore.filters.allTypes')}</SelectItem>
              <SelectItem value="land">{t('explore.filters.land')}</SelectItem>
              <SelectItem value="seaplane">{t('explore.filters.seaplane')}</SelectItem>
              <SelectItem value="heliport">{t('explore.filters.heliport')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Has IATA */}
        <div className="flex items-center space-x-2 pt-6">
          <Checkbox
            id="hasIata"
            checked={hasIata}
            onCheckedChange={(checked) => onHasIataChange(checked === true)}
          />
          <Label htmlFor="hasIata">{t('explore.filters.hasIata')}</Label>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: May fail if Checkbox component doesn't exist - create stub if needed

**Step 3: Commit**

```bash
git add src/components/layout/Toolbar/ExplorePanel/FiltersTab.tsx
git commit -m "feat(explore): add FiltersTab component"
```

---

## Task 8: Create FeaturedTab Component

**Files:**

- Create: `src/components/layout/Toolbar/ExplorePanel/FeaturedTab.tsx`

**Step 1: Create FeaturedTab**

```typescript
// src/components/layout/Toolbar/ExplorePanel/FeaturedTab.tsx

import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { getFeaturedAirportsByCategory, type FeaturedCategory } from '@/data';
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
  challenging: '🏔️',
  scenic: '🌅',
  unique: '✨',
  historic: '🏛️',
};

export function FeaturedTab({
  category,
  onCategoryChange,
  onSelectAirport,
}: FeaturedTabProps) {
  const { t } = useTranslation();
  const airports = getFeaturedAirportsByCategory(category);

  return (
    <div className="space-y-4">
      {/* Category chips */}
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

      {/* Airport cards */}
      <div className="grid gap-2">
        {airports.map((airport) => (
          <button
            key={airport.icao}
            onClick={() => onSelectAirport(airport.icao)}
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
          >
            <span className="text-lg">
              {CATEGORY_ICONS[airport.category]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">
                  {airport.icao}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {airport.tagline}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
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
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/layout/Toolbar/ExplorePanel/FeaturedTab.tsx
git commit -m "feat(explore): add FeaturedTab component"
```

---

## Task 9: Create RoutesTab Component

**Files:**

- Create: `src/components/layout/Toolbar/ExplorePanel/RoutesTab.tsx`

**Step 1: Create RoutesTab**

```typescript
// src/components/layout/Toolbar/ExplorePanel/RoutesTab.tsx

import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';
import { FEATURED_ROUTES } from '@/data';
import { cn } from '@/lib/utils';
import type { RoutesTabProps } from './types';

export function RoutesTab({ selectedRoute, onSelectRoute }: RoutesTabProps) {
  const { t } = useTranslation();

  const isSelected = (from: string, to: string) =>
    selectedRoute?.from === from && selectedRoute?.to === to;

  const handleClick = (from: string, to: string) => {
    if (isSelected(from, to)) {
      onSelectRoute(null);
    } else {
      onSelectRoute({ from, to });
    }
  };

  return (
    <div className="grid gap-2">
      {FEATURED_ROUTES.map((route) => (
        <button
          key={`${route.from}-${route.to}`}
          onClick={() => handleClick(route.from, route.to)}
          className={cn(
            'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
            isSelected(route.from, route.to)
              ? 'border-primary bg-primary/10'
              : 'border-border bg-background hover:bg-muted'
          )}
        >
          <Plane className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {route.from}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono text-sm font-medium">
                {route.to}
              </span>
            </div>
            <div className="mt-1 text-sm text-foreground">{route.name}</div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {route.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/layout/Toolbar/ExplorePanel/RoutesTab.tsx
git commit -m "feat(explore): add RoutesTab component"
```

---

## Task 10: Add ExplorePanel Index Exports

**Files:**

- Modify: `src/components/layout/Toolbar/ExplorePanel/index.tsx`

**Step 1: Update index to export all components**

Add at the end of `index.tsx`:

```typescript
export { FiltersTab } from './FiltersTab';
export { FeaturedTab } from './FeaturedTab';
export { RoutesTab } from './RoutesTab';
export type * from './types';
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/layout/Toolbar/ExplorePanel/index.tsx
git commit -m "feat(explore): add ExplorePanel exports"
```

---

## Task 11: Add Translation Keys

**Files:**

- Modify: `src/i18n/locales/en.json`

**Step 1: Add explore translations**

Add to en.json:

```json
"explore": {
  "tabs": {
    "filters": "Filters",
    "featured": "Featured",
    "routes": "Routes"
  },
  "filters": {
    "country": "Country",
    "region": "Region",
    "type": "Type",
    "hasIata": "IATA airports only",
    "allCountries": "All countries",
    "allRegions": "All regions",
    "allTypes": "All types",
    "land": "Land",
    "seaplane": "Seaplane",
    "heliport": "Heliport"
  },
  "featured": {
    "all": "All",
    "challenging": "Challenging",
    "scenic": "Scenic",
    "unique": "Unique",
    "historic": "Historic"
  }
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/i18n/locales/en.json
git commit -m "feat(explore): add translation keys"
```

---

## Task 12: Integrate ExplorePanel into Toolbar

**Files:**

- Modify: `src/components/layout/Toolbar/index.tsx`

**Step 1: Read current Toolbar**

Read `src/components/layout/Toolbar/index.tsx` to understand the structure.

**Step 2: Add expand toggle and ExplorePanel**

Import ExplorePanel and add:

- ChevronDown/ChevronUp icon button next to search
- ExplorePanel component below toolbar
- Wire up to mapStore explore state

**Step 3: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Verify in browser**

Run: `npm start`

- Click the expand icon next to search
- Verify panel opens with 3 tabs
- Verify tabs switch correctly
- Verify Featured tab shows airport cards

**Step 5: Commit**

```bash
git add src/components/layout/Toolbar/index.tsx
git commit -m "feat(explore): integrate ExplorePanel into Toolbar"
```

---

## Task 13: Add RouteLineLayer for Map

**Files:**

- Create: `src/components/Map/layers/dynamic/RouteLineLayer.ts`

**Step 1: Create RouteLineLayer**

```typescript
// src/components/Map/layers/dynamic/RouteLineLayer.ts
import * as turf from '@turf/turf';
import type { Map } from 'maplibre-gl';

const SOURCE_ID = 'route-line-source';
const LAYER_ID = 'route-line';

export const ROUTE_LINE_LAYER_IDS = [LAYER_ID];

export function addRouteLineLayer(map: Map): void {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': '#f59e0b',
      'line-width': 2,
      'line-dasharray': [4, 2],
    },
  });
}

export function updateRouteLine(
  map: Map,
  route: { from: [number, number]; to: [number, number] } | null
): void {
  const source = map.getSource(SOURCE_ID);
  if (!source || source.type !== 'geojson') return;

  if (!route) {
    source.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  // Create great circle arc
  const line = turf.greatCircle(turf.point(route.from), turf.point(route.to), { npoints: 100 });

  source.setData({
    type: 'FeatureCollection',
    features: [line],
  });
}

export function removeRouteLineLayer(map: Map): void {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/Map/layers/dynamic/RouteLineLayer.ts
git commit -m "feat(explore): add RouteLineLayer for route visualization"
```

---

## Task 14: Export RouteLineLayer

**Files:**

- Modify: `src/components/Map/layers/dynamic/index.ts`

**Step 1: Add export**

```typescript
export * from './RouteLineLayer';
```

**Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/Map/layers/dynamic/index.ts
git commit -m "feat(explore): export RouteLineLayer"
```

---

## Task 15: Wire Up Route Selection to Map

**Files:**

- Modify: `src/components/Map/index.tsx` or appropriate hook

**Step 1: Read Map component**

Understand how other dynamic layers are managed.

**Step 2: Add route line layer management**

- Initialize RouteLineLayer when map loads
- Subscribe to mapStore.explore.selectedRoute changes
- Update route line when selection changes
- Look up airport coordinates from database

**Step 3: Verify**

Run: `npm start`

- Open Explore panel
- Go to Routes tab
- Click a route
- Verify line appears on map
- Click again to deselect
- Verify line disappears

**Step 4: Commit**

```bash
git add src/components/Map/
git commit -m "feat(explore): wire up route selection to map layer"
```

---

## Task 16: Add Airport Fly-To from Featured Tab

**Files:**

- Modify: `src/components/layout/Toolbar/ExplorePanel/index.tsx`

**Step 1: Implement handleSelectAirport**

Wire up the handleSelectAirport function to:

- Look up airport coordinates from database
- Use map.flyTo() to navigate to the airport
- Optionally select the airport in appStore

**Step 2: Verify**

Run: `npm start`

- Open Explore panel
- Go to Featured tab
- Click an airport card
- Verify map flies to that location

**Step 3: Commit**

```bash
git add src/components/layout/Toolbar/ExplorePanel/index.tsx
git commit -m "feat(explore): add fly-to functionality for featured airports"
```

---

## Task 17: Final Verification

**Step 1: Run full check**

```bash
npm run typecheck && npm run lint
```

Expected: PASS

**Step 2: Manual testing checklist**

- [ ] Expand icon shows next to search bar
- [ ] Click expand opens panel
- [ ] Filters tab shows dropdowns (data can be empty for now)
- [ ] Featured tab shows category chips
- [ ] Featured tab shows airport cards with descriptions
- [ ] Clicking airport card flies map to location
- [ ] Routes tab shows route list
- [ ] Clicking route draws line on map
- [ ] Clicking selected route removes line
- [ ] Panel closes when clicking outside or toggle

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(explore): complete explore feature implementation"
```

---

## Summary

| Task | Description                               |
| ---- | ----------------------------------------- |
| 1    | Add curated data types                    |
| 2    | Add featured airports data (~28 airports) |
| 3    | Add featured routes data (~17 routes)     |
| 4    | Add data index exports                    |
| 5    | Add explore state to mapStore             |
| 6    | Create ExplorePanel structure             |
| 7    | Create FiltersTab component               |
| 8    | Create FeaturedTab component              |
| 9    | Create RoutesTab component                |
| 10   | Add ExplorePanel exports                  |
| 11   | Add translation keys                      |
| 12   | Integrate into Toolbar                    |
| 13   | Create RouteLineLayer                     |
| 14   | Export RouteLineLayer                     |
| 15   | Wire up route selection                   |
| 16   | Add airport fly-to                        |
| 17   | Final verification                        |
