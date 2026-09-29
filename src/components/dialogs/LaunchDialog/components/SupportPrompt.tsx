import i18n from 'i18next';
import { ExternalLink, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/queries';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';

const KOFI_URL = 'https://ko-fi.com/A0A21V3IZZ';
const MIN_LAUNCHES = 2;

function dismiss() {
  useSettingsStore.getState().updateSupportSettings({ promptDismissed: true });
}

/**
 * Show a support toast after the user's 2nd successful launch.
 * Call this from the launch success handler.
 */
export function showSupportToastIfEligible(): void {
  const { promptDismissed } = useSettingsStore.getState().support;
  const { logbook } = useLaunchStore.getState();

  if (promptDismissed || logbook.length < MIN_LAUNCHES) return;

  // Small delay so the launch dialog closes first
  setTimeout(() => {
    // Not a component, so no useTranslation; read the current language at show time.
    const t = i18n.t.bind(i18n);
    trackEvent('support_prompt_shown', {});
    toast.custom(
      (id) => (
        <div className="border-primary/20 bg-card flex items-start gap-3 rounded-lg border p-4 shadow-lg">
          <Heart className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-medium">{t('supportPrompt.title')}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t('supportPrompt.description')}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  trackEvent('donate_clicked', { source: 'support_prompt' });
                  window.open(KOFI_URL, '_blank');
                  dismiss();
                  toast.dismiss(id);
                }}
              >
                {t('supportPrompt.donate')}
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  trackEvent('support_prompt_dismissed', { forever: false });
                  toast.dismiss(id);
                }}
              >
                {t('supportPrompt.notNow')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground/60"
                onClick={() => {
                  trackEvent('support_prompt_dismissed', { forever: true });
                  dismiss();
                  toast.dismiss(id);
                }}
              >
                {t('supportPrompt.dontShowAgain')}
              </Button>
            </div>
          </div>
        </div>
      ),
      { duration: Infinity, position: 'bottom-center' }
    );
  }, 1500);
}
