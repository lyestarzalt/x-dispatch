import type { FeaturedRoute } from '@/types/featured';

export const FEATURED_ROUTES: FeaturedRoute[] = [
  // === LONG HAUL / TRANSATLANTIC ===
  {
    from: 'KJFK',
    to: 'EGLL',
    name: 'North Atlantic Classic',
    description: 'Busiest transatlantic route in the world.',
  },
  {
    from: 'LFPG',
    to: 'KJFK',
    name: 'Paris-New York',
    description: 'Iconic route once flown by Concorde.',
  },
  {
    from: 'KLAX',
    to: 'RJTT',
    name: 'Pacific Crossing',
    description: 'Los Angeles to Tokyo over the Pacific.',
  },
  {
    from: 'KSFO',
    to: 'VHHH',
    name: 'Gateway to Asia',
    description: 'San Francisco to Hong Kong corridor.',
  },
  {
    from: 'OMDB',
    to: 'EGLL',
    name: 'Emirates Classic',
    description: 'Dubai to London, extremely profitable route.',
  },
  {
    from: 'EDDF',
    to: 'KSFO',
    name: 'Lufthansa Flagship',
    description: 'Frankfurt to San Francisco long haul.',
  },
  {
    from: 'WSSS',
    to: 'YPPH',
    name: 'Indian Ocean Hop',
    description: 'Singapore to Perth across Indian Ocean.',
  },
  {
    from: 'RJTT',
    to: 'PHNL',
    name: 'Tokyo-Honolulu',
    description: 'Popular vacation route to Hawaii.',
  },

  // === SCENIC / MOUNTAIN ROUTES ===
  {
    from: 'EDDF',
    to: 'LOWI',
    name: 'Alpine Approach',
    description: 'Frankfurt to Innsbruck challenging mountain approach.',
  },
  {
    from: 'LOWI',
    to: 'LSZS',
    name: 'Alpine Challenge',
    description: 'Innsbruck to Samedan, two legendary mountain airports.',
  },
  {
    from: 'LFMN',
    to: 'LSGG',
    name: "Côte d'Azur to Alps",
    description: 'Nice to Geneva through the French Alps.',
  },
  {
    from: 'SCEL',
    to: 'SAEZ',
    name: 'Andes Crossing',
    description: 'Santiago to Buenos Aires over the Andes.',
  },
  {
    from: 'VNKT',
    to: 'VQPR',
    name: 'Himalayan Challenge',
    description: 'Kathmandu to Paro, extreme mountain flying.',
  },
  {
    from: 'PANC',
    to: 'PAJN',
    name: 'Alaska Glacier Run',
    description: 'Anchorage to Juneau along glaciers and fjords.',
  },
  {
    from: 'KSFO',
    to: 'KDEN',
    name: 'Rockies Crossing',
    description: 'San Joaquin Valley to Rocky Mountains.',
  },
  {
    from: 'BIRK',
    to: 'BIAR',
    name: 'Iceland Traverse',
    description: 'Reykjavik to Akureyri, stunning volcanic scenery.',
  },
  {
    from: 'NZQN',
    to: 'NZWN',
    name: 'NZ Southern Alps',
    description: 'Queenstown to Wellington, incredible NZ scenery.',
  },

  // === CHALLENGING APPROACHES ===
  {
    from: 'KMIA',
    to: 'TNCM',
    name: 'Caribbean Classic',
    description: 'Miami to St Maarten famous low beach approach.',
  },
  {
    from: 'EGLL',
    to: 'LXGB',
    name: 'Rock Approach',
    description: 'London to Gibraltar, approach next to the Rock.',
  },
  {
    from: 'LPPT',
    to: 'LPMA',
    name: 'Madeira Challenge',
    description: 'Lisbon to Funchal, cliffside runway in Atlantic.',
  },
  {
    from: 'VHHH',
    to: 'VHHX',
    name: 'Kai Tak Legend',
    description: 'The legendary checkerboard approach (historic).',
  },
  {
    from: 'TFFR',
    to: 'TFFJ',
    name: 'St Barts Drop',
    description: 'Guadeloupe to St Barts, steep hilltop approach.',
  },
  {
    from: 'LGAV',
    to: 'LGSK',
    name: 'Greek Island Hop',
    description: 'Athens to Skiathos, the "St Maarten of Europe".',
  },
  {
    from: 'KDCA',
    to: 'KLGA',
    name: 'River Visual',
    description: 'Reagan to LaGuardia, famous Potomac river approach.',
  },

  // === POPULAR SHORT/MEDIUM HAUL ===
  {
    from: 'LOWW',
    to: 'EDDM',
    name: 'Vienna-Munich',
    description: '47 min average, perfect short haul ops.',
  },
  {
    from: 'ESSA',
    to: 'EKCH',
    name: 'Nordic Shuttle',
    description: 'Stockholm to Copenhagen, busy Scandinavian route.',
  },
  {
    from: 'RJBB',
    to: 'RJTT',
    name: 'Kansai Express',
    description: 'Osaka Kansai to Tokyo Haneda business shuttle.',
  },
  {
    from: 'SBRJ',
    to: 'SBSP',
    name: 'Ponte Aérea',
    description: "Rio to São Paulo, world's busiest air bridge.",
  },
  {
    from: 'KLAS',
    to: 'KLAX',
    name: 'Vegas Run',
    description: 'Quick hop from Las Vegas to Los Angeles.',
  },
  {
    from: 'KATL',
    to: 'KFLL',
    name: 'Sunshine Route',
    description: 'Atlanta to Fort Lauderdale, busy Florida route.',
  },
  {
    from: 'EGLL',
    to: 'EHAM',
    name: 'Channel Hop',
    description: 'London to Amsterdam, quick European business route.',
  },
  {
    from: 'YMHB',
    to: 'YMML',
    name: 'Tasmanian Link',
    description: 'Hobart to Melbourne across Bass Strait.',
  },

  // === ISLAND HOPPING ===
  {
    from: 'PAKT',
    to: 'PAJN',
    name: 'Inside Passage',
    description: 'Ketchikan to Juneau, Alaska coastal beauty.',
  },
  {
    from: 'YSSY',
    to: 'NZAA',
    name: 'Trans-Tasman',
    description: 'Sydney to Auckland across Tasman Sea.',
  },
  {
    from: 'VRMM',
    to: 'VRMV',
    name: 'Maldives Seaplane',
    description: 'Malé to a resort island, turquoise waters.',
  },
  {
    from: 'LIRN',
    to: 'LIEE',
    name: 'Italian Islands',
    description: 'Naples to Cagliari over Sardinia.',
  },
  {
    from: 'PHKO',
    to: 'PHNL',
    name: 'Hawaiian Inter-Island',
    description: 'Kona to Honolulu, Big Island to Oahu.',
  },

  // === ASIA PACIFIC ===
  {
    from: 'WSSS',
    to: 'VHHH',
    name: 'Asian Tiger Route',
    description: 'Singapore to Hong Kong financial hubs.',
  },
  {
    from: 'VHHH',
    to: 'RPLL',
    name: 'South China Sea',
    description: 'Hong Kong to Manila, island to island.',
  },
  {
    from: 'VTBS',
    to: 'WSSS',
    name: 'SEA Corridor',
    description: 'Bangkok to Singapore, busy Southeast Asian route.',
  },
  {
    from: 'RKSI',
    to: 'RJTT',
    name: 'Korea-Japan',
    description: 'Incheon to Tokyo, major Asian business route.',
  },
];
