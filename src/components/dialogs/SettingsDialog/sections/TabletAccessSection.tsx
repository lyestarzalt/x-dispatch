import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, RefreshCw, Tablet, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsRemoteClient } from '@/hooks/useIsRemoteClient';
import { MAX_REMOTE_PORT, MIN_REMOTE_PORT, parsePort } from '@/lib/remote/port';
import { cn } from '@/lib/utils/helpers';
import {
  useDisconnectRemoteClients,
  useRemoteAccessStatus,
  useResetRemoteToken,
  useSetRemoteEnabled,
  useSetRemotePort,
} from '@/queries/useRemoteAccessQuery';
import {
  SettingsEmptyState,
  SettingsHeader,
  SettingsPathDisplay,
  SettingsSectionBlock,
  SettingsToggleRow,
} from '../primitives';
import { QrCode } from './QrCode';

interface SettingsSectionProps {
  className?: string;
}

export function TabletAccessSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const remote = useIsRemoteClient();
  const status = useRemoteAccessStatus(!remote);
  const setEnabled = useSetRemoteEnabled();
  const resetToken = useResetRemoteToken();
  const disconnectAll = useDisconnectRemoteClients();
  const setPort = useSetRemotePort();
  const data = status.data;
  // Null while the field shows the saved port; a string while the user edits it.
  const [portDraft, setPortDraft] = useState<string | null>(null);
  const portText = portDraft ?? String(data?.port ?? '');
  const parsedPort = parsePort(portText);
  const portInvalid = portDraft !== null && portDraft !== '' && parsedPort === null;

  const applyPort = () => {
    setPortDraft(null);
    if (parsedPort !== null && parsedPort !== data?.port) setPort.mutate(parsedPort);
  };
  const url = data?.urls[0];

  const copyUrl = async () => {
    if (!url) return;
    await window.appAPI.clipboardWrite(url);
    toast.success(t('settings.tablet.copied'));
  };

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Tablet}
        title={t('settings.tablet.title')}
        description={t('settings.tablet.description')}
      />

      {remote ? (
        <SettingsEmptyState message={t('tablet.desktopOnly')} />
      ) : (
        <>
          <SettingsSectionBlock title={t('settings.tablet.accessSection')}>
            {window.appAPI.platform === 'win32' && (
              <div className="border-warning/40 bg-warning/5 rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">{t('settings.tablet.firewallNote')}</p>
              </div>
            )}
            <SettingsToggleRow
              title={t('settings.tablet.enable')}
              description={t('settings.tablet.enableDesc')}
              checked={data?.enabled ?? false}
              disabled={!data || setEnabled.isPending}
              onCheckedChange={(checked) => setEnabled.mutate(checked)}
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="min-w-0">
                <Label htmlFor="tablet-port" className="text-sm font-medium">
                  {t('settings.tablet.port')}
                </Label>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t('settings.tablet.portDesc', { min: MIN_REMOTE_PORT, max: MAX_REMOTE_PORT })}
                </p>
                {portInvalid && (
                  <p className="text-destructive mt-1 text-xs">
                    {t('settings.tablet.portInvalid', {
                      min: MIN_REMOTE_PORT,
                      max: MAX_REMOTE_PORT,
                    })}
                  </p>
                )}
              </div>
              <Input
                id="tablet-port"
                inputMode="numeric"
                value={portText}
                disabled={!data || setPort.isPending}
                aria-invalid={portInvalid}
                onChange={(e) => setPortDraft(e.target.value)}
                onBlur={applyPort}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-28 shrink-0 font-mono text-sm"
              />
            </div>
            {data?.error && (
              <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
                <p className="text-destructive text-sm">
                  {t('settings.tablet.startError', { error: data.error })}
                </p>
              </div>
            )}
          </SettingsSectionBlock>

          {data?.running && (
            <>
              <SettingsSectionBlock
                title={t('settings.tablet.pairSection')}
                description={t('settings.tablet.pairDesc')}
              >
                {url ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="border-border bg-background text-foreground w-44 shrink-0 rounded-lg border p-3">
                      <QrCode value={url} className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <SettingsPathDisplay path={url} />
                      {data.urls.length > 1 && (
                        <p className="text-muted-foreground text-xs">
                          {t('settings.tablet.otherAddresses', {
                            addresses: data.urls.slice(1).join(', '),
                          })}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={copyUrl}>
                          <Copy className="h-3.5 w-3.5" />
                          {t('settings.tablet.copyLink')}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t('settings.tablet.resetPairing')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t('settings.tablet.resetPairing')}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('settings.tablet.resetPairingConfirm')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resetToken.mutate(undefined)}>
                                {t('settings.tablet.resetPairing')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ) : (
                  <SettingsEmptyState message={t('settings.tablet.noNetwork')} />
                )}
              </SettingsSectionBlock>

              <SettingsSectionBlock
                title={
                  <span className="flex items-center gap-2">
                    {t('settings.tablet.devicesSection')}
                    <Badge variant="outline" className="font-mono text-xs">
                      {data.clients.length}
                    </Badge>
                  </span>
                }
              >
                {data.clients.length === 0 ? (
                  <SettingsEmptyState message={t('settings.tablet.noDevices')} />
                ) : (
                  <div className="space-y-2">
                    {data.clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="xp-label truncate">{client.userAgent || client.ip}</p>
                          <p className="xp-value">
                            {client.ip} · {new Date(client.connectedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => disconnectAll.mutate(undefined)}
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      {t('settings.tablet.disconnectAll')}
                    </Button>
                  </div>
                )}
              </SettingsSectionBlock>
            </>
          )}
        </>
      )}
    </div>
  );
}
