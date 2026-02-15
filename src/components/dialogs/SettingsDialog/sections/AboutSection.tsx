import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppVersion } from '@/hooks/useAppVersion';
import { cn } from '@/lib/utils';
import type { SettingsSectionProps } from '../types';

const GITHUB_REPO = 'https://github.com/lyestarzalt/x-dispatch';
const GITHUB_ISSUES = 'https://github.com/lyestarzalt/x-dispatch/issues';

export default function AboutSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const version = useAppVersion();
  const [logPath, setLogPath] = useState<string | null>(null);

  useEffect(() => {
    window.appAPI.getLogPath().then(setLogPath);
  }, []);

  const handleOpenExternal = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* App Identity */}
      <div className="flex flex-col items-center pt-4 text-center">
        <img src="assets/icon.png" alt="X-Dispatch" className="mb-4 h-20 w-20 rounded-xl" />
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

      {/* Troubleshooting */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.about.troubleshooting')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.about.troubleshootingDescription')}
        </p>
        {logPath && (
          <p className="truncate rounded bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            {logPath}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.appAPI.openLogFile()}
          >
            <FileText className="mr-2 h-4 w-4" />
            {t('settings.about.openLog')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.appAPI.openLogFolder()}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            {t('settings.about.openFolder')}
          </Button>
        </div>
      </div>
    </div>
  );
}
