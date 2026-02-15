import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, FolderOpen } from 'lucide-react';
import { AppLogo } from '@/components/ui/AppLogo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppVersion } from '@/hooks/useAppVersion';
import { cn } from '@/lib/utils/helpers';
import type { SettingsSectionProps } from '../types';

const GITHUB_REPO = 'https://github.com/lyestarzalt/x-dispatch';
const GITHUB_ISSUES = 'https://github.com/lyestarzalt/x-dispatch/issues';

export default function AboutSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const version = useAppVersion();
  const [logPath, setLogPath] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);

  useEffect(() => {
    window.appAPI.getLogPath().then(setLogPath);
    window.appAPI.getConfigPath().then(setConfigPath);
  }, []);

  const handleOpenExternal = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* App Identity */}
      <div className="flex flex-col items-center pt-4 text-center">
        <AppLogo size="lg" className="mb-4" />
        <h1 className="xp-detail-heading">X-Dispatch</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {version ? `Version ${version}` : '...'}
        </p>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          {t('settings.about.description')}
        </p>
      </div>

      <Separator />

      {/* Credits & Links */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.credits')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.about.developer')}</span>
              <span>Lyes Tarzalt</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('settings.about.license')}</span>
              <span>GPL-3.0</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="xp-section-heading">{t('settings.about.links')}</h3>
          <div className="space-y-1">
            <button
              onClick={() => handleOpenExternal(GITHUB_REPO)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <span>{t('settings.about.sourceCode')}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => handleOpenExternal(GITHUB_ISSUES)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <span>{t('settings.about.reportIssue')}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Data Storage */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.about.dataStorage')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.about.dataStorageDescription')}
        </p>

        {/* Config Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t('settings.about.settingsCache', 'Settings & Cache')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2"
              onClick={() => window.appAPI.openConfigFolder()}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t('settings.about.openDataFolder')}
            </Button>
          </div>
          {configPath && (
            <p className="truncate rounded bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              {configPath}
            </p>
          )}
        </div>

        {/* Log Path */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t('settings.about.logFile', 'Log File')}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={() => window.appAPI.openLogFile()}
              >
                <FileText className="h-3.5 w-3.5" />
                {t('settings.about.openLog')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => window.appAPI.openLogFolder()}
                title={t('settings.about.openLogFolder', 'Show in folder')}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {logPath && (
            <p className="truncate rounded bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              {logPath}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
