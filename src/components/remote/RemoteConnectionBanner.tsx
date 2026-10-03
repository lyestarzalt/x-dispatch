import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { useIsRemoteClient } from '@/hooks/useIsRemoteClient';
import type { RemoteConnectionState } from '@/lib/bridge/browser/wsTransport';

/** Tablet only: shows when the link to the desktop app is down. */
export function RemoteConnectionBanner() {
  const { t } = useTranslation();
  const remote = useIsRemoteClient();
  const [state, setState] = useState<RemoteConnectionState>('connected');

  useEffect(() => {
    if (!remote) return;
    let off = () => undefined as void;
    void import('@/lib/bridge/browser/installRemoteBridge').then(({ onRemoteConnectionState }) => {
      off = onRemoteConnectionState(setState);
    });
    return () => off();
  }, [remote]);

  if (!remote || state === 'connected' || state === 'connecting') return null;
  return (
    <div className="bg-warning/10 border-warning/40 text-foreground fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 border-b px-4 py-2 text-sm">
      <WifiOff className="text-warning h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        {state === 'pairing-reset' ? t('tablet.pairingReset') : t('tablet.reconnecting')}
      </span>
    </div>
  );
}
