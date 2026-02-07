import type { FeaturedRoute } from './types';

export const FEATURED_ROUTES: FeaturedRoute[] = [
  {
    from: 'KJFK',
    to: 'EGLL',
    name: 'North Atlantic Classic',
    description: 'One of the busiest transatlantic routes.',
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
    from: 'WSSS',
    to: 'VHHH',
    name: 'Asian Tiger Route',
    description: 'Singapore to Hong Kong financial hubs.',
  },
  {
    from: 'VHHH',
    to: 'RJTT',
    name: 'Far East Express',
    description: 'Hong Kong to Tokyo business route.',
  },
  { from: 'EGLL', to: 'LEMD', name: 'London-Madrid', description: 'Popular European route.' },
  { from: 'EDDF', to: 'LFPG', name: 'Rhine-Seine', description: 'Frankfurt to Paris hubs.' },
  {
    from: 'NZQN',
    to: 'NZMF',
    name: 'Scenic NZ Hop',
    description: 'Queenstown to Milford Sound fjords.',
  },
  {
    from: 'LOWI',
    to: 'LSZS',
    name: 'Alpine Challenge',
    description: 'Two challenging mountain airports.',
  },
  {
    from: 'PAKT',
    to: 'PAJN',
    name: 'Alaska Coastal',
    description: 'Ketchikan to Juneau Inside Passage.',
  },
  {
    from: 'OMDB',
    to: 'EGLL',
    name: 'Emirates Classic',
    description: 'Dubai to London profitable route.',
  },
  {
    from: 'OEJN',
    to: 'VABB',
    name: 'Hajj Route',
    description: 'Jeddah to Mumbai pilgrimage corridor.',
  },
  { from: 'KMIA', to: 'SBGR', name: 'Americas Corridor', description: 'Miami to São Paulo.' },
  {
    from: 'MMMX',
    to: 'KLAX',
    name: 'Mexico City Express',
    description: 'High-altitude departure to LA.',
  },
  {
    from: 'YSSY',
    to: 'NZAA',
    name: 'Trans-Tasman',
    description: 'Sydney to Auckland across Tasman Sea.',
  },
  {
    from: 'YSSY',
    to: 'WSSS',
    name: 'Kangaroo Route Leg',
    description: 'Sydney to Singapore to Europe.',
  },
];

export function getFeaturedRoute(from: string, to: string): FeaturedRoute | undefined {
  return FEATURED_ROUTES.find((r) => r.from === from && r.to === to);
}
