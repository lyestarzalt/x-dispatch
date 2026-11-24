import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAcknowledgeSimulationNotice } from '@/queries';

/**
 * Shown once to every pilot: the app, its charts and its data are for flight simulation only.
 * Closing it without the button asks again at the next launch.
 */
export function SimulationNoticeDialog() {
  const { t } = useTranslation();
  const acknowledge = useAcknowledgeSimulationNotice();
  const [dismissed, setDismissed] = useState(false);

  return (
    <Dialog open={!dismissed} onOpenChange={(open) => !open && setDismissed(true)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="bg-warning/10 mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
            <TriangleAlert className="text-warning h-5 w-5" />
          </div>
          <DialogTitle>{t('simulationNotice.title')}</DialogTitle>
          <DialogDescription>{t('simulationNotice.body')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="min-w-0"
            disabled={acknowledge.isPending}
            onClick={() => acknowledge.mutate()}
          >
            <span className="truncate">{t('simulationNotice.accept')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
