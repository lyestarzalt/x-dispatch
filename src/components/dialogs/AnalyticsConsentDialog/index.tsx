import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAnalyticsConsent, useSetAnalyticsConsent } from '@/queries';

const PRIVACY_URL = 'https://x-dispatch.app/privacy/';

/**
 * One-time opt-in for usage analytics. Nothing is sent until the user accepts;
 * closing without choosing asks again next launch.
 */
export function AnalyticsConsentDialog() {
  const { t } = useTranslation();
  const { data } = useAnalyticsConsent();
  const setConsent = useSetAnalyticsConsent();
  const [dismissed, setDismissed] = useState(false);

  const open = !!data?.shouldPrompt && !dismissed;

  const choose = (granted: boolean) => {
    setConsent.mutate(granted);
    setDismissed(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setDismissed(true)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
            <BarChart3 className="text-primary h-5 w-5" />
          </div>
          <DialogTitle>{t('analytics.consent.title')}</DialogTitle>
          <DialogDescription>{t('analytics.consent.description')}</DialogDescription>
        </DialogHeader>

        <Separator />

        <dl className="space-y-4">
          <div className="flex gap-3">
            <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <dt className="xp-section-heading">{t('analytics.consent.collectedTitle')}</dt>
              <dd className="text-foreground mt-1 text-sm">{t('analytics.consent.collected')}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Minus className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <dt className="xp-section-heading">{t('analytics.consent.notCollectedTitle')}</dt>
              <dd className="text-foreground mt-1 text-sm">
                {t('analytics.consent.notCollected')}
              </dd>
            </div>
          </div>
        </dl>

        <p className="text-muted-foreground text-xs">
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => window.appAPI.openExternal(PRIVACY_URL)}
          >
            {t('analytics.consent.privacyLink')}
          </button>
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="min-w-0 flex-1" onClick={() => choose(false)}>
            <span className="truncate">{t('analytics.consent.decline')}</span>
          </Button>
          <Button className="min-w-0 flex-1" onClick={() => choose(true)}>
            <span className="truncate">{t('analytics.consent.accept')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
