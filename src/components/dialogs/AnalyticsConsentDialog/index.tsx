import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Check, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="text-primary h-5 w-5" />
            {t('analytics.consent.title')}
          </DialogTitle>
          <DialogDescription>{t('analytics.consent.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="border-success/40 bg-success/5 rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Check className="text-success h-4 w-4 shrink-0" />
              {t('analytics.consent.collectedTitle')}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{t('analytics.consent.collected')}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <X className="text-muted-foreground h-4 w-4 shrink-0" />
              {t('analytics.consent.notCollectedTitle')}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('analytics.consent.notCollected')}
            </p>
          </div>
          <Button
            variant="link"
            className="h-auto gap-1 p-0 text-sm"
            onClick={() => window.appAPI.openExternal(PRIVACY_URL)}
          >
            {t('analytics.consent.privacyLink')}
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="min-w-0 flex-1" onClick={() => choose(false)}>
            <span className="truncate">{t('analytics.consent.decline')}</span>
          </Button>
          <Button variant="outline" className="min-w-0 flex-1" onClick={() => choose(true)}>
            <span className="truncate">{t('analytics.consent.accept')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
