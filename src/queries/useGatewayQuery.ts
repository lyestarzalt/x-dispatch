import { useQuery } from '@tanstack/react-query';

export interface GatewayScenery {
  sceneryId: number;
  parentId: number;
  userId: number;
  userName: string;
  dateUpload: string;
  dateAccepted: string | null;
  dateApproved: string | null;
  dateDeclined: string | null;
  type: '2D' | '3D';
  features: string;
  artistComments: string;
  moderatorComments: string;
  Status: 'Uploaded' | 'Accepted' | 'Approved' | 'Declined';
}

export interface GatewayAirport {
  airportCode: string;
  airportName: string;
  latitude: number;
  longitude: number;
  recommendedSceneryId: number;
  approvedSceneryCount: number;
  acceptedSceneryCount: number;
  sceneryPacks?: GatewayScenery[];
}

export const gatewayKeys = {
  all: ['gateway'] as const,
  airport: (icao: string) => ['gateway', 'airport', icao.toUpperCase()] as const,
};

async function fetchGatewayData(icao: string): Promise<GatewayAirport | null> {
  try {
    const response = await window.airportAPI.fetchGatewayAirport(icao);
    if (!response.data || response.error) return null;
    return JSON.parse(response.data) as GatewayAirport;
  } catch {
    return null;
  }
}

export function useGatewayQuery(icao: string | null) {
  return useQuery({
    queryKey: gatewayKeys.airport(icao ?? ''),
    queryFn: () => fetchGatewayData(icao!),
    enabled: !!icao,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}

export function getRecommendedScenery(airport: GatewayAirport | null): GatewayScenery | null {
  if (!airport?.sceneryPacks) return null;
  return airport.sceneryPacks.find((s) => s.sceneryId === airport.recommendedSceneryId) || null;
}

export function formatGatewayDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
