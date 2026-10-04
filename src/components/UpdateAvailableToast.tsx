import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { isNewerVersion } from '@/lib/utils/versionCompare';
import { trackEvent, useAppVersion, useUpdateStatus } from '@/queries';
import { Button } from './ui/button';

const trackNoticeClick = () => trackEvent('update_notice_clicked', {});

interface UpdateToastProps {
  id: string | number;
  icon: typeof Download;
  title: string;
  description: string;
  action: string;
  actionIcon?: typeof ExternalLink;
  dismiss: string;
  onAction: () => void;
}

function UpdateToast({
  id,
  icon: Icon,
  title,
  description,
  action,
  actionIcon: ActionIcon,
  dismiss,
  onAction,
}: UpdateToastProps) {
  return (
    <div className="border-primary/20 bg-card flex items-start gap-3 rounded-lg border p-4 shadow-lg">
      <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              onAction();
              toast.dismiss(id);
            }}
          >
            {action}
            {ActionIcon && <ActionIcon className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => toast.dismiss(id)}
          >
            {dismiss}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shows one toast per update: a download notice where the user installs by hand,
 * and a restart prompt once the Windows updater has the new version on disk.
 */
export function UpdateAvailableToast(): null {
  const { t } = useTranslation();
  const { data: update } = useUpdateStatus();
  const { data: version } = useAppVersion();

  const downloadVersion =
    update &&
    !update.managed &&
    version &&
    update.latestVersion &&
    isNewerVersion(version, update.latestVersion)
      ? update.latestVersion
      : null;
  const url = update?.url;

  useEffect(() => {
    if (!downloadVersion || !url) return;
    trackEvent('update_found', { method: 'notice' });
    toast.custom(
      (id) => (
        <UpdateToast
          id={id}
          icon={Download}
          title={t('update.available.title')}
          description={t('update.available.description', { version: downloadVersion })}
          action={t('update.available.download')}
          actionIcon={ExternalLink}
          dismiss={t('update.available.dismiss')}
          onAction={() => {
            trackNoticeClick();
            window.appAPI.openExternal(url);
          }}
        />
      ),
      { id: `update-available-${downloadVersion}`, duration: Infinity, position: 'bottom-center' }
    );
  }, [downloadVersion, url, t]);

  const readyVersion =
    update?.install === 'ready' ? (update.installVersion ?? update.latestVersion ?? '') : null;

  useEffect(() => {
    if (readyVersion === null) return;
    toast.custom(
      (id) => (
        <UpdateToast
          id={id}
          icon={RefreshCw}
          title={t('update.ready.title')}
          description={t('update.ready.description', { version: readyVersion })}
          action={t('update.ready.restart')}
          dismiss={t('update.ready.dismiss')}
          onAction={() => void window.appAPI.installUpdate()}
        />
      ),
      { id: 'update-ready', duration: Infinity, position: 'bottom-center' }
    );
  }, [readyVersion, t]);

  return null;
}
