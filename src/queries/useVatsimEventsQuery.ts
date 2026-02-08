import { useQuery } from '@tanstack/react-query';
import type { VatsimEvent } from '@/types/vatsim';

export type { VatsimEvent };

const vatsimEventsKeys = {
  all: ['vatsim-events'] as const,
};

async function fetchVatsimEvents(): Promise<VatsimEvent[]> {
  const response = await window.airportAPI.fetchVatsimEvents();
  if (!response.data || response.error) {
    throw new Error(response.error || 'Failed to fetch VATSIM events');
  }
  return response.data.data || [];
}

export function useVatsimEventsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: vatsimEventsKeys.all,
    queryFn: fetchVatsimEvents,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min - events don't change often
    gcTime: 30 * 60 * 1000,
    refetchInterval: enabled ? 5 * 60 * 1000 : false,
  });
}

/**
 * Get event status based on current time
 */
export function getEventStatus(event: VatsimEvent): 'live' | 'soon' | 'upcoming' {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  if (now >= start && now <= end) {
    return 'live';
  }

  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (start <= twoHoursFromNow && start > now) {
    return 'soon';
  }

  return 'upcoming';
}

/**
 * Get time until event starts or ends
 */
export function getEventTimeInfo(event: VatsimEvent): string {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  if (now >= start && now <= end) {
    const remaining = end.getTime() - now.getTime();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
  }

  if (start > now) {
    const until = start.getTime() - now.getTime();
    const hours = Math.floor(until / (1000 * 60 * 60));
    const minutes = Math.floor((until % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;
  }

  return 'ended';
}
