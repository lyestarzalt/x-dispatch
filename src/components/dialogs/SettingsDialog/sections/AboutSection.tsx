import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  CircleCheck,
  Download,
  FileText,
  FolderOpen,
  Info,
  RefreshCw,
  ScrollText,
  TriangleAlert,
} from 'lucide-react';
import { KofiMark } from '@/components/icons/BrandMarks';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { AppLogo } from '@/components/ui/AppLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PROJECT_WEBSITE } from '@/config/links';
import { cn } from '@/lib/utils/helpers';
import { isNewerVersion } from '@/lib/utils/versionCompare';
import {
  trackEvent,
  useAppVersion,
  useCheckForUpdates,
  useConfigPath,
  useLogPath,
  useUpdateStatus,
} from '@/queries';
import type { UpdateStatus } from '@/types/update';
import { ThirdPartyNoticesDialog } from '../ThirdPartyNoticesDialog';
import {
  SettingsHeader,
  SettingsLinkRow,
  SettingsPathDisplay,
  SettingsSectionBlock,
  SettingsToggleRow,
} from '../primitives';
import type { SettingsSectionProps } from '../types';

const trackDonateClick = () => trackEvent('donate_clicked', { source: 'settings_about' });
const KOFI_URL = 'https://ko-fi.com/A0A21V3IZZ';

interface UpdateStatusRowProps {
  version: string;
  update: UpdateStatus;
  checking: boolean;
  onCheck: () => void;
}

/** What the updater is doing, and the one action that fits. */
function UpdateStatusRow({ version, update, checking, onCheck }: UpdateStatusRowProps) {
  const { t } = useTranslation();
  const outdated = !!update.latestVersion && isNewerVersion(version, update.latestVersion);
  const busy = checking || update.install === 'checking';

  let status: React.ReactNode;
  let action: React.ReactNode = (
    <Button size="sm" variant="ghost" disabled={busy} onClick={onCheck}>
      <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
      {t('settings.about.checkForUpdates')}
    </Button>
  );

  if (update.install === 'ready') {
    status = (
      <span className="text-success inline-flex items-center gap-1.5">
        <CircleCheck className="h-4 w-4 shrink-0" />
        {t('settings.about.updateReady', {
          version: update.installVersion ?? update.latestVersion ?? '',
        })}
      </span>
    );
    action = (
      <DesktopOnly>
        <Button size="sm" variant="outline" onClick={() => void window.appAPI.installUpdate()}>
          <RefreshCw className="h-3.5 w-3.5" />
          {t('settings.about.restartToUpdate')}
        </Button>
      </DesktopOnly>
    );
  } else if (busy) {
    status = (
      <span className="text-muted-foreground inline-flex items-center gap-1.5">
        <Spinner className="size-4 shrink-0" />
        {t('settings.about.checkingForUpdates')}
      </span>
    );
  } else if (update.install === 'downloading') {
    status = (
      <span className="text-info inline-flex items-center gap-1.5">
        <Download className="h-4 w-4 shrink-0" />
        {t('settings.about.downloadingUpdate')}
      </span>
    );
    action = null;
  } else if (update.install === 'error') {
    status = (
      <span className="text-warning inline-flex items-center gap-1.5">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        {t('settings.about.updateCheckFailed')}
      </span>
    );
    action = (
      <Button size="sm" variant="ghost" onClick={onCheck}>
        <RefreshCw className="h-3.5 w-3.5" />
        {t('settings.about.tryAgain')}
      </Button>
    );
  } else if (outdated) {
    status = (
      <span className="text-info inline-flex items-center gap-1.5">
        <Download className="h-4 w-4 shrink-0" />
        {t('settings.about.updateAvailable', { version: update.latestVersion })}
      </span>
    );
    if (!update.managed) {
      action = (
        <Button size="sm" variant="outline" onClick={() => window.appAPI.openExternal(update.url)}>
          <Download className="h-3.5 w-3.5" />
          {t('update.available.download')}
        </Button>
      );
    }
  } else if (update.latestVersion) {
    status = (
      <span className="text-success inline-flex items-center gap-1.5">
        <CircleCheck className="h-4 w-4 shrink-0" />
        {t('settings.about.upToDate')}
      </span>
    );
  }

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="min-w-0">{status}</span>
      {action}
    </div>
  );
}

export default function AboutSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const { data: logPath } = useLogPath();
  const { data: configPath } = useConfigPath();
  const { data: update } = useUpdateStatus();
  const check = useCheckForUpdates();

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Info}
        title={t('settings.about.title')}
        description={t('settings.about.description')}
      />

      <div className="flex items-center gap-4">
        <AppLogo size="md" />
        <div className="min-w-0">
          <h1 className="xp-detail-heading">X-Dispatch</h1>
          <p className="text-muted-foreground font-mono text-sm">
            {version ? `v${version}` : t('common.loading')}
          </p>
        </div>
      </div>

      {version && update && (
        <SettingsSectionBlock title={t('settings.about.updates')}>
          <div className="divide-border divide-y rounded-lg border">
            <UpdateStatusRow
              version={version}
              update={update}
              checking={check.isPending}
              onCheck={() => check.mutate()}
            />
            {update.managed && (
              <DesktopOnly>
                <SettingsToggleRow
                  className="rounded-none border-0"
                  title={t('settings.about.betaUpdates')}
                  description={
                    update.betaAvailable && update.latestBetaVersion
                      ? t('settings.about.betaUpdatesAvailable', {
                          version: update.latestBetaVersion,
                        })
                      : t('settings.about.betaUpdatesNone')
                  }
                  checked={update.betaEnabled}
                  disabled={!update.betaAvailable}
                  onCheckedChange={(enabled) => window.appAPI.setBetaUpdates(enabled)}
                />
              </DesktopOnly>
            )}
          </div>
        </SettingsSectionBlock>
      )}

      {/* Credits + Links side-by-side */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.credits')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.developer')}</span>
              <span className="min-w-0 truncate text-right">
                {t('settings.about.developerName')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.license')}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {t('settings.about.licenseValue')}
              </Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t('settings.about.testingCommunity')}</span>
              <span className="min-w-0 truncate text-right">
                {t('settings.about.testingCommunityName')}{' '}
                <span className="text-muted-foreground">
                  {t('settings.about.testingCommunityHandle')}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.links')}</h3>
          <div className="space-y-1">
            <SettingsLinkRow label={t('settings.about.website')} href={PROJECT_WEBSITE} />
            <Button
              variant="ghost"
              onClick={() => setNoticesOpen(true)}
              className="hover:bg-secondary h-auto w-full justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ScrollText className="text-muted-foreground h-3.5 w-3.5" />
                <span className="truncate">{t('settings.about.thirdParty')}</span>
              </span>
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
            </Button>
            <ThirdPartyNoticesDialog open={noticesOpen} onOpenChange={setNoticesOpen} />
            <SettingsLinkRow
              label={t('settings.about.supportProject')}
              href={KOFI_URL}
              leadingIcon={<KofiMark />}
              onOpen={trackDonateClick}
            />
          </div>
        </div>
      </div>

      {/* Data Storage */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.about.dataStorage')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.about.dataStorageDescription')}
        </p>

        {/* Config Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t('settings.about.settingsCache')}
            </span>
            <DesktopOnly>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={() => window.appAPI.openConfigFolder()}
                disabled={!configPath}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t('settings.about.openDataFolder')}
              </Button>
            </DesktopOnly>
          </div>
          {configPath && <SettingsPathDisplay path={configPath} />}
        </div>

        {/* Log Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{t('settings.about.logFile')}</span>
            <div className="flex gap-1">
              <DesktopOnly>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2"
                  onClick={() => window.appAPI.openLogFile()}
                  disabled={!logPath}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t('settings.about.openLog')}
                </Button>
              </DesktopOnly>
              <DesktopOnly>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => window.appAPI.openLogFolder()}
                  disabled={!logPath}
                  tooltip={t('settings.about.openLogFolder')}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </DesktopOnly>
            </div>
          </div>
          {logPath && <SettingsPathDisplay path={logPath} />}
        </div>
      </div>

      <div className="text-muted-foreground space-y-1.5 border-t pt-4 text-center text-xs">
        <p>{t('settings.about.projectNotice')}</p>
        <p>{t('settings.about.independenceNotice')}</p>
        <p>{t('settings.about.simulationOnly')}</p>
      </div>
    </div>
  );
}
