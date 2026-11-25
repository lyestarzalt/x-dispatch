import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/ui/AppLogo';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAcknowledgeSimulationNotice, useAppVersion } from '@/queries';

/**
 * Shown once to every pilot: the app, its charts and its data are for flight simulation only.
 * It is the first thing a new pilot reads, so it carries the app's mark and version in the
 * same centred arrangement as the setup screen. Escape closes it without acknowledging, and
 * it asks again at the next launch.
 */
export function SimulationNoticeDialog() {
  const { t } = useTranslation();
  const { data: version } = useAppVersion();
  const acknowledge = useAcknowledgeSimulationNotice();
  const [dismissed, setDismissed] = useState(false);

  return (
    <AlertDialog open={!dismissed} onOpenChange={(open) => !open && setDismissed(true)}>
      <AlertDialogContent className="max-w-md gap-5 p-8">
        <AlertDialogHeader className="items-center space-y-3 sm:text-center">
          <AppLogo size="md" />
          <AlertDialogTitle className="xp-page-heading leading-tight">
            {t('simulationNotice.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center leading-relaxed">
            {t('simulationNotice.body')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Separator />

        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          {t('settings.about.independenceNotice')}
        </p>

        <AlertDialogFooter className="sm:justify-center sm:space-x-0">
          {/* The primary button, not the stock action: that one is styled for a destructive confirm. */}
          <Button className="w-full" onClick={() => acknowledge.mutate()}>
            <span className="min-w-0 truncate">{t('simulationNotice.accept')}</span>
          </Button>
        </AlertDialogFooter>

        {version && (
          <p className="text-muted-foreground/50 text-center font-mono text-xs">
            {t('simulationNotice.version', { version })}
          </p>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
