import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isModuleActive } from '@/lib/modules/registry';
import { useSiaInstallStatusQuery } from '@/queries/useSiaQuery';
import { useModulesStore } from '@/stores/modulesStore';

/** Notify once per session when a newer SIA AIRAC catalog is available. */
export function SiaUpdateBanner() {
  const { t } = useTranslation();
  const modules = useModulesStore((s) => s.modules);
  const siaEnabled = isModuleActive(modules, 'sia-france');
  const { data: status } = useSiaInstallStatusQuery(siaEnabled);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!siaEnabled || shownRef.current || !status?.updateAvailable) return;
    shownRef.current = true;
    toast.info(t('sia.updateAvailable', { cycle: status.latestCatalogCycle }), {
      duration: 10_000,
    });
  }, [siaEnabled, status?.updateAvailable, status?.latestCatalogCycle, t]);

  return null;
}
