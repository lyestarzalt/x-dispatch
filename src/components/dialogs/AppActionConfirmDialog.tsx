import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/stores/appStore';

/**
 * Asks before an xdispatch:// link fetches anything remote. The host is shown
 * so the user can tell a link from the website from one pasted in a chat.
 */
export function AppActionConfirmDialog() {
  const { t } = useTranslation();
  const confirmation = useAppStore((s) => s.pendingConfirmation);
  const resolveConfirmation = useAppStore((s) => s.resolveConfirmation);

  if (!confirmation) return null;

  return (
    <AlertDialog open onOpenChange={(open) => !open && resolveConfirmation(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('appActions.importConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('appActions.importConfirm.description', { host: confirmation.host })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="bg-secondary/50 text-muted-foreground truncate rounded px-3 py-2 font-mono text-sm">
          {confirmation.url}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveConfirmation(false)}>
            {t('appActions.importConfirm.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => resolveConfirmation(true)}>
            {t('appActions.importConfirm.download')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
