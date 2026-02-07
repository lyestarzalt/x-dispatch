import type { FeaturedAirport } from './types';

export const FEATURED_AIRPORTS: FeaturedAirport[] = [
  // === CHALLENGING ===
  {
    icao: 'VNLK',
    category: 'challenging',
    tagline: "World's most dangerous",
    description: 'Lukla sits at 9,383 ft with a 527m runway ending in a cliff. One shot approach.',
  },
  {
    icao: 'LOWI',
    category: 'challenging',
    tagline: 'Alpine valley approach',
    description:
      'Innsbruck requires a curved approach through a narrow valley surrounded by peaks.',
  },
  {
    icao: 'VQPR',
    category: 'challenging',
    tagline: 'Himalayan zigzag',
    description:
      'Paro is one of the hardest airports. Visual-only approaches through mountain passes.',
  },
  {
    icao: 'LPMA',
    category: 'challenging',
    tagline: 'Runway on stilts',
    description: 'Madeira features a runway on columns over the Atlantic. Notorious crosswinds.',
  },
  {
    icao: 'LFLJ',
    category: 'challenging',
    tagline: 'Ski slope runway',
    description: 'Courchevel has an 18.5% gradient. Take off downhill, land uphill.',
  },
  {
    icao: 'TNCM',
    category: 'challenging',
    tagline: 'Beach threshold',
    description: 'St Maarten is famous for jets passing meters above sunbathers on Maho Beach.',
  },
  {
    icao: 'TFFJ',
    category: 'challenging',
    tagline: 'Hilltop drop',
    description: 'St Barts requires diving over a hill then immediate flare. Short runway.',
  },
  {
    icao: 'LGSK',
    category: 'challenging',
    tagline: 'St Maarten of Europe',
    description: 'Skiathos has a short runway with road at threshold. Low approaches over beach.',
  },
  {
    icao: 'ENSD',
    category: 'challenging',
    tagline: 'Norwegian fjord',
    description: 'Sandane sits in a narrow fjord with mountains on three sides.',
  },
  {
    icao: 'MHTG',
    category: 'challenging',
    tagline: 'Steep terrain approach',
    description: 'Toncontín in Honduras requires a sharp turn between mountains on final.',
  },
  {
    icao: 'LSZS',
    category: 'challenging',
    tagline: 'Highest in Europe',
    description: 'Samedan at 5,600 ft in the Engadin valley. Thin air, mountain backdrop.',
  },
  {
    icao: 'EKVG',
    category: 'challenging',
    tagline: 'North Atlantic gales',
    description: 'Vágar in Faroe Islands: extreme weather, short runway, terrain everywhere.',
  },
  {
    icao: 'SPZO',
    category: 'challenging',
    tagline: 'Andes high altitude',
    description: 'Cusco at 10,860 ft. Reduced engine performance requires careful planning.',
  },
  {
    icao: 'SBRJ',
    category: 'challenging',
    tagline: 'Downtown Rio',
    description: 'Santos Dumont has a 1,323m runway between Sugarloaf Mountain and Guanabara Bay.',
  },

  // === SCENIC ===
  {
    icao: 'NZQN',
    category: 'scenic',
    tagline: 'Mountains meet lake',
    description: 'Queenstown offers stunning Remarkables views and Lake Wakatipu approach.',
  },
  {
    icao: 'NZMF',
    category: 'scenic',
    tagline: 'Fjord airstrip',
    description:
      'Milford Sound sits in a glacial valley surrounded by sheer cliffs and waterfalls.',
  },
  {
    icao: 'FACT',
    category: 'scenic',
    tagline: 'Table Mountain backdrop',
    description: 'Cape Town offers breathtaking views of Table Mountain and the coastline.',
  },
  {
    icao: 'BIRK',
    category: 'scenic',
    tagline: 'Volcanic island',
    description: "Reykjavik gives access to Iceland's dramatic volcanic and glacial landscapes.",
  },
  {
    icao: 'PANC',
    category: 'scenic',
    tagline: 'Alaska glaciers',
    description: 'Anchorage surrounded by Chugach Mountains. Gateway to wilderness flying.',
  },
  {
    icao: 'PAJN',
    category: 'scenic',
    tagline: 'Inside Passage',
    description: 'Juneau nestled between mountains and Mendenhall Glacier. Fjord approach.',
  },
  {
    icao: 'ENTC',
    category: 'scenic',
    tagline: 'Arctic Norway',
    description: 'Tromsø offers northern lights, fjords, and snow-capped peaks.',
  },
  {
    icao: 'VRMM',
    category: 'scenic',
    tagline: 'Turquoise lagoons',
    description: 'Malé in Maldives: runway on an island, crystal-clear water approaches.',
  },
  {
    icao: 'FSIA',
    category: 'scenic',
    tagline: 'Tropical paradise',
    description: 'Seychelles offers pristine beaches and turquoise waters on approach.',
  },
  {
    icao: 'NTAA',
    category: 'scenic',
    tagline: 'South Pacific',
    description: "Tahiti Faa'a with Moorea's volcanic peaks across the lagoon.",
  },
  {
    icao: 'ENSB',
    category: 'scenic',
    tagline: 'Arctic wilderness',
    description: 'Svalbard: one of the northernmost airports. Polar bears and glaciers.',
  },
  {
    icao: 'KSEZ',
    category: 'scenic',
    tagline: 'Red rock desert',
    description: "Sedona sits among Arizona's famous red rock formations.",
  },
  {
    icao: 'YBHM',
    category: 'scenic',
    tagline: 'Great Barrier Reef',
    description: 'Hamilton Island in the Whitsundays. Turquoise waters and coral reefs.',
  },
  {
    icao: 'LSGG',
    category: 'scenic',
    tagline: 'Alps and lake',
    description: 'Geneva with Mont Blanc views and Lake Geneva on approach.',
  },

  // === UNIQUE ===
  {
    icao: 'LXGB',
    category: 'unique',
    tagline: 'Road crosses runway',
    description:
      "Gibraltar's runway is intersected by the main road into Spain. Traffic stops for planes.",
  },
  {
    icao: 'EGHE',
    category: 'unique',
    tagline: 'Beach runway',
    description: 'Barra uses the beach as runway - only scheduled beach airport in the world.',
  },
  {
    icao: 'RJTT',
    category: 'unique',
    tagline: 'Tokyo Bay island',
    description: 'Haneda on reclaimed land. Spectacular illuminated city night approaches.',
  },
  {
    icao: 'RJBB',
    category: 'unique',
    tagline: 'Floating airport',
    description: 'Kansai built on an artificial island in Osaka Bay. Engineering marvel.',
  },
  {
    icao: 'KSAN',
    category: 'unique',
    tagline: 'Urban canyon',
    description: 'San Diego has one of the most urban approaches - between downtown skyscrapers.',
  },
  {
    icao: 'EGLC',
    category: 'unique',
    tagline: 'Steep city approach',
    description: 'London City requires a steep 5.5° glideslope over the Thames and Docklands.',
  },
  {
    icao: 'KDCA',
    category: 'unique',
    tagline: 'River Visual',
    description: "Reagan National's famous river approach follows the Potomac past monuments.",
  },
  {
    icao: 'VMMC',
    category: 'unique',
    tagline: 'Casino skyline',
    description: 'Macau features curved approach over Pearl River Delta with casino towers.',
  },
  {
    icao: 'VHHH',
    category: 'unique',
    tagline: 'Checkerboard successor',
    description: 'Hong Kong International on Chek Lap Kok island. Replaced legendary Kai Tak.',
  },

  // === HISTORIC ===
  {
    icao: 'VHHX',
    category: 'historic',
    tagline: 'The checkerboard turn',
    description:
      'Kai Tak (closed 1998) was famous for its 47° turn at 200 ft. Legendary among pilots.',
  },
  {
    icao: 'EDDT',
    category: 'historic',
    tagline: 'Berlin Airlift',
    description: 'Tempelhof was the site of the 1948 Berlin Airlift. Now closed, forever iconic.',
  },
  {
    icao: 'LFPB',
    category: 'historic',
    tagline: 'Lindbergh landed here',
    description: 'Le Bourget: where Lindbergh completed his transatlantic crossing in 1927.',
  },
  {
    icao: 'KOSH',
    category: 'historic',
    tagline: 'EAA AirVenture',
    description: "Oshkosh hosts the world's largest aviation gathering every summer.",
  },
  {
    icao: 'EGKK',
    category: 'historic',
    tagline: 'WWII origins',
    description: 'Gatwick started as a 1920s aerodrome, served as RAF base in WWII.',
  },
  {
    icao: 'KLAS',
    category: 'historic',
    tagline: 'Desert transformed',
    description: 'Las Vegas McCarran: from desert airstrip to major international hub.',
  },
];

export function getFeaturedAirportsByCategory(
  category: 'all' | 'challenging' | 'scenic' | 'unique' | 'historic'
): FeaturedAirport[] {
  if (category === 'all') return FEATURED_AIRPORTS;
  return FEATURED_AIRPORTS.filter((a) => a.category === category);
}

export function getFeaturedAirport(icao: string): FeaturedAirport | undefined {
  return FEATURED_AIRPORTS.find((a) => a.icao === icao);
}
