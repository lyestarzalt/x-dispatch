import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import { ExternalLink, Heart, LifeBuoy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/helpers';
import type { SettingsSectionProps } from '../types';

const GITHUB_ISSUES = 'https://github.com/lyestarzalt/x-dispatch/issues';
const DISCORD_INVITE = 'https://discord.gg/76UYpxXWW7';

export default function SupportSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();

  // Feedback form state
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Crash reports setting (persisted in main process config)
  const [sendCrashReports, setSendCrashReports] = useState(false);
  const [isLoadingCrashReports, setIsLoadingCrashReports] = useState(true);

  useEffect(() => {
    window.appAPI.getSendCrashReports().then((enabled) => {
      setSendCrashReports(enabled);
      setIsLoadingCrashReports(false);
    });
  }, []);

  const handleCrashReportsChange = async (enabled: boolean) => {
    setSendCrashReports(enabled);
    await window.appAPI.setSendCrashReports(enabled);
  };

  const handleSubmitFeedback = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    try {
      Sentry.captureFeedback({
        message: message.trim(),
        ...(email.trim() && { email: email.trim() }),
      });
      toast.success(t('settings.support.sendSuccess'));
      setMessage('');
      setEmail('');
    } catch {
      toast.error(t('settings.support.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenExternal = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <LifeBuoy className="h-5 w-5" />
          {t('settings.tabs.support')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.support.reportDescription')}</p>
      </div>

      <Separator />

      {/* Report a Problem */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.support.reportProblem')}</h3>
        <div className="space-y-3 rounded-lg border p-4">
          <Textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            placeholder={t('settings.support.messagePlaceholder')}
            className="min-h-[100px] resize-none"
          />
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="xp-label mb-1.5 block">{t('settings.support.emailLabel')}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('settings.support.emailPlaceholder')}
              />
            </div>
            <Button
              onClick={handleSubmitFeedback}
              disabled={!message.trim() || isSending}
              className="shrink-0 gap-2"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('settings.support.sendReport')}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Community */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.support.community')}</h3>
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => handleOpenExternal(GITHUB_ISSUES)}
            className="h-auto w-full justify-between px-3 py-2 text-sm hover:bg-secondary"
          >
            <span>{t('settings.about.reportIssue')}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleOpenExternal(DISCORD_INVITE)}
            className="h-auto w-full justify-between px-3 py-2 text-sm hover:bg-secondary"
          >
            <span>Discord</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleOpenExternal('https://ko-fi.com/A0A21V3IZZ')}
            className="h-auto w-full justify-between px-3 py-2 text-sm hover:bg-secondary"
          >
            <span className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-red-400" />
              Support this project
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Privacy */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.support.privacy')}</h3>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('settings.about.crashReports')}</p>
            <p className="text-sm text-muted-foreground">
              {t('settings.about.crashReportsDescription')}
            </p>
          </div>
          <Switch
            checked={sendCrashReports}
            onCheckedChange={handleCrashReportsChange}
            disabled={isLoadingCrashReports}
          />
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.about.crashReportsNote')}</p>
      </div>
    </div>
  );
}
