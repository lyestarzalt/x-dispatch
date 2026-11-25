import { useSimulationNotice } from '@/queries';
import { AnalyticsConsentDialog } from './AnalyticsConsentDialog';
import { SimulationNoticeDialog } from './SimulationNoticeDialog';

/**
 * What a pilot is asked at first launch, one dialog at a time: the simulation-only notice,
 * then the usage-data choice once that is acknowledged.
 */
export function FirstLaunchNotices() {
  const { data } = useSimulationNotice();
  if (!data) return null;
  return data.shouldShow ? <SimulationNoticeDialog /> : <AnalyticsConsentDialog />;
}
