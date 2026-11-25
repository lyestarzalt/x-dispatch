import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const simulationNoticeKey = ['app', 'simulationNotice'] as const;

/** Whether the one-time "for flight simulation only" notice is still to be shown. */
export function useSimulationNotice() {
  return useQuery({
    queryKey: simulationNoticeKey,
    queryFn: () => window.appAPI.getSimulationNotice(),
    staleTime: Infinity,
  });
}

/** Records that the pilot has read the notice, so it is not shown again. */
export function useAcknowledgeSimulationNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => window.appAPI.acknowledgeSimulationNotice(),
    onSuccess: () => queryClient.setQueryData(simulationNoticeKey, { shouldShow: false }),
  });
}
