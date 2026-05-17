import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSiaInstallStatusQuery } from '@/queries/useSiaQuery';

/** Notify once per session when a newer SIA AIRAC catalog is available. */
export function SiaUpdateBanner() {
  const { t } = useTranslation();
  const { data: status } = useSiaInstallStatusQuery();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current || !status?.updateAvailable) return;
    shownRef.current = true;
    toast.info(t('sia.updateAvailable', { cycle: status.latestCatalogCycle }), {
      duration: 10_000,
    });
  }, [status?.updateAvailable, status?.latestCatalogCycle, t]);

  return null;
}
