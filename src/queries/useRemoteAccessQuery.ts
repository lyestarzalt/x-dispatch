import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RemoteAccessStatus } from '@/lib/remote/types';

export const remoteAccessKey = ['remoteAccess', 'status'] as const;

export function useRemoteAccessStatus(enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return window.remoteAccessAPI.onStatusChanged((status) => {
      queryClient.setQueryData(remoteAccessKey, status);
    });
  }, [enabled, queryClient]);
  return useQuery({
    queryKey: remoteAccessKey,
    queryFn: () => window.remoteAccessAPI.getStatus(),
    enabled,
    staleTime: 10_000,
  });
}

function useStatusMutation<A>(fn: (arg: A) => Promise<RemoteAccessStatus>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (status) => queryClient.setQueryData(remoteAccessKey, status),
  });
}

export const useSetRemoteEnabled = () =>
  useStatusMutation((enabled: boolean) => window.remoteAccessAPI.setEnabled(enabled));
export const useResetRemoteToken = () =>
  useStatusMutation(() => window.remoteAccessAPI.resetToken());
export const useDisconnectRemoteClients = () =>
  useStatusMutation(() => window.remoteAccessAPI.disconnectAll());
export const useSetRemotePort = () =>
  useStatusMutation((port: number) => window.remoteAccessAPI.setPort(port));
