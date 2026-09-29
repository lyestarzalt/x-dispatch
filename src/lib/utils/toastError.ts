import type { ReactNode } from 'react';
import { type ExternalToast, toast } from 'sonner';
import type { AnalyticsErrorArea } from '@/lib/analytics/events';
import { trackEvent } from '@/queries/useAnalytics';

/** Shows an error toast and records the area it came from, never the message. */
export function toastError(area: AnalyticsErrorArea, message: ReactNode, options?: ExternalToast) {
  trackEvent('error_shown', { area });
  return toast.error(message, options);
}
