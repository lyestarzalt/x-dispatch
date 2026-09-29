import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnalyticsEventName,
  AnalyticsEventProps,
  AnalyticsFeature,
} from '@/lib/analytics/events';

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

/** Fire-and-forget. Consent and the allowlist are enforced in the main process. */
export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventProps<E>
): void {
  window.analyticsAPI.track(event, properties);
}

/** Records one `feature_opened` event each time `open` turns true. */
export function useTrackFeatureOpened(feature: AnalyticsFeature, open: boolean) {
  useEffect(() => {
    if (open) trackEvent('feature_opened', { feature });
  }, [feature, open]);
}
