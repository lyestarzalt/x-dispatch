import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateChannel, UpdateStatus } from '@/types/update';

const updateKeys = {
  status: ['app', 'updateStatus'] as const,
};

/** Main owns the update state and pushes every change; the query only mirrors it. */
export function useUpdateStatus() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      window.appAPI.onUpdateStatus((status) => {
        queryClient.setQueryData<UpdateStatus>(updateKeys.status, status);
      }),
    [queryClient]
  );
  return useQuery<UpdateStatus>({
    queryKey: updateKeys.status,
    queryFn: () => window.appAPI.getUpdateStatus(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCheckForUpdates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => window.appAPI.checkForUpdates(),
    onSuccess: (status) => queryClient.setQueryData<UpdateStatus>(updateKeys.status, status),
  });
}

export function useSetUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channel: UpdateChannel) => window.appAPI.setUpdateChannel(channel),
    onSuccess: (status) => queryClient.setQueryData<UpdateStatus>(updateKeys.status, status),
  });
}
