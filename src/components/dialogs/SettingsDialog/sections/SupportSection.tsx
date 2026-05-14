import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react';
import { Heart, LifeBuoy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/helpers';
import { SettingsHeader, SettingsLinkRow, SettingsToggleRow } from '../primitives';
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

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={LifeBuoy}
        title={t('settings.tabs.support')}
        description={t('settings.support.reportDescription')}
      />

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
          <SettingsLinkRow label={t('settings.about.reportIssue')} href={GITHUB_ISSUES} />
          <SettingsLinkRow label={t('settings.support.discord')} href={DISCORD_INVITE} />
          <SettingsLinkRow
            label={t('settings.about.supportProject')}
            href="https://ko-fi.com/A0A21V3IZZ"
            leadingIcon={<Heart className="h-3.5 w-3.5 text-red-400" />}
          />
        </div>
      </div>

      <Separator />

      {/* Privacy */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">{t('settings.support.privacy')}</h3>
        <SettingsToggleRow
          title={t('settings.about.crashReports')}
          description={t('settings.about.crashReportsDescription')}
          checked={sendCrashReports}
          onCheckedChange={handleCrashReportsChange}
          disabled={isLoadingCrashReports}
        />
        <p className="text-sm text-muted-foreground">{t('settings.about.crashReportsNote')}</p>
      </div>
    </div>
  );
}
