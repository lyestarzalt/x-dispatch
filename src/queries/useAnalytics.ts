import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalyticsFeature } from '@/lib/analytics/events';

const analyticsKeys = {
  consent: ['analytics', 'consent'] as const,
};

export function useAnalyticsConsent() {
  return useQuery({
    queryKey: analyticsKeys.consent,
    queryFn: () => window.analyticsAPI.getConsent(),
    staleTime: Infinity,
  });
}

export function useSetAnalyticsConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (granted: boolean) => window.analyticsAPI.setConsent(granted),
    onSettled: () => queryClient.invalidateQueries({ queryKey: analyticsKeys.consent }),
  });
}

/** Records one `feature_opened` event each time `open` turns true. Consent is enforced in main. */
export function useTrackFeatureOpened(feature: AnalyticsFeature, open: boolean) {
  useEffect(() => {
    if (open) window.analyticsAPI.trackFeature(feature);
  }, [feature, open]);
}
