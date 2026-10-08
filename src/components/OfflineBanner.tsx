import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { onlineManager } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const isOnline = () => onlineManager.isOnline();

/** Desktop only: a tablet fetches through the PC, so its own connection says nothing. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useSyncExternalStore(subscribe, isOnline);
  // ponytail: navigator.onLine stays true on Wi-Fi without internet; add a real reachability probe if pilots ask.
  if (online || window.appAPI.isRemoteClient) return null;
  return (
    <div className="bg-warning/10 border-warning/40 text-foreground flex shrink-0 items-center justify-center gap-2 border-b px-4 py-2 text-sm">
      <WifiOff className="text-warning h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{t('app.offline')}</span>
    </div>
  );
}
