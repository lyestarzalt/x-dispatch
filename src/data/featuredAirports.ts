import type { FeaturedAirport } from './types';

export const FEATURED_AIRPORTS: FeaturedAirport[] = [
  // Challenging
  {
    icao: 'VNLK',
    category: 'challenging',
    tagline: "World's most dangerous airport",
    description:
      'Tenzing-Hillary Airport sits at 9,383 ft in the Himalayas with a 527m runway ending in a cliff.',
  },
  {
    icao: 'LOWI',
    category: 'challenging',
    tagline: 'Valley approach through the Alps',
    description:
      'Innsbruck requires a precise curved approach through a narrow valley surrounded by mountains.',
  },
  {
    icao: 'VQPR',
    category: 'challenging',
    tagline: 'Himalayan zigzag approach',
    description:
      'Paro is one of the most difficult airports. Pilots navigate steep terrain with visual approaches only.',
  },
  {
    icao: 'LPMA',
    category: 'challenging',
    tagline: 'Columns over the Atlantic',
    description:
      'Madeira features a runway extended on massive columns over the ocean. Strong crosswinds.',
  },
  {
    icao: 'SBRJ',
    category: 'challenging',
    tagline: 'City center, short runway',
    description:
      'Santos Dumont sits in downtown Rio with a 1,323m runway between Sugarloaf and the bay.',
  },
  {
    icao: 'LFLJ',
    category: 'challenging',
    tagline: 'The ski slope runway',
    description:
      'Courchevel has an 18.5% gradient runway. Aircraft take off downhill and land uphill.',
  },
  {
    icao: 'EKVG',
    category: 'challenging',
    tagline: 'North Atlantic crosswinds',
    description:
      'Vágar in the Faroe Islands features extreme weather, short runway, and terrain on all sides.',
  },
  {
    icao: 'SPZO',
    category: 'challenging',
    tagline: 'High altitude Andes',
    description:
      'Cusco sits at 10,860 ft elevation. Thin air affects aircraft performance significantly.',
  },
  // Scenic
  {
    icao: 'NZQN',
    category: 'scenic',
    tagline: 'Mountains meet the lake',
    description: 'Queenstown offers stunning views of the Remarkables and Lake Wakatipu.',
  },
  {
    icao: 'NZMF',
    category: 'scenic',
    tagline: 'Fjord landing',
    description:
      'Milford Sound airstrip sits in a glacial valley surrounded by sheer cliffs and waterfalls.',
  },
  {
    icao: 'FSIA',
    category: 'scenic',
    tagline: 'Tropical paradise',
    description: 'Seychelles offers approaches over turquoise waters and pristine beaches.',
  },
  {
    icao: 'VRMM',
    category: 'scenic',
    tagline: 'Overwater approach',
    description:
      'Malé features a runway on a separate island. Approach over crystal-clear lagoons.',
  },
  {
    icao: 'NTAA',
    category: 'scenic',
    tagline: 'Pacific island paradise',
    description: "Faa'a in Tahiti offers views of Moorea's volcanic peaks across the lagoon.",
  },
  {
    icao: 'FMEE',
    category: 'scenic',
    tagline: 'Volcanic island approach',
    description: 'Réunion Island offers dramatic views of Piton de la Fournaise volcano.',
  },
  {
    icao: 'KSEZ',
    category: 'scenic',
    tagline: 'Red rock desert',
    description: "Sedona sits among Arizona's famous red rock formations.",
  },
  {
    icao: 'ENSB',
    category: 'scenic',
    tagline: 'Arctic wilderness',
    description: 'Svalbard is one of the northernmost airports. Approach over glaciers and fjords.',
  },
  // Unique
  {
    icao: 'LXGB',
    category: 'unique',
    tagline: 'Road crosses the runway',
    description: "Gibraltar's runway is intersected by the main road into Spain.",
  },
  {
    icao: 'EGHE',
    category: 'unique',
    tagline: 'Beach runway',
    description:
      'Barra uses the beach as its runway - the only scheduled beach airport in the world.',
  },
  {
    icao: 'RJTT',
    category: 'unique',
    tagline: 'City island at night',
    description: 'Haneda sits on reclaimed land in Tokyo Bay. Spectacular illuminated city views.',
  },
  {
    icao: 'KSAN',
    category: 'unique',
    tagline: 'Downtown approach',
    description: 'San Diego has one of the most urban approaches - descending between skyscrapers.',
  },
  {
    icao: 'EGLC',
    category: 'unique',
    tagline: 'Steep city center approach',
    description: 'London City requires a steep 5.5° approach over the Thames.',
  },
  {
    icao: 'VMMC',
    category: 'unique',
    tagline: 'Casino skyline',
    description: 'Macau features a curved approach over the Pearl River Delta with casino towers.',
  },
  // Historic
  {
    icao: 'EDDT',
    category: 'historic',
    tagline: 'Berlin Airlift legacy',
    description: 'Tempelhof was the site of the historic Berlin Airlift. Now closed but iconic.',
  },
  {
    icao: 'VHHX',
    category: 'historic',
    tagline: 'The checkerboard turn',
    description: 'Kai Tak (closed 1998) was famous for its 47° turn at 200 ft. Legendary.',
  },
  {
    icao: 'LFPB',
    category: 'historic',
    tagline: 'Aviation birthplace',
    description: 'Le Bourget is where Lindbergh landed after crossing the Atlantic.',
  },
  {
    icao: 'KOSH',
    category: 'historic',
    tagline: 'EAA AirVenture home',
    description: "Wittman Regional hosts the world's largest aviation gathering.",
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
