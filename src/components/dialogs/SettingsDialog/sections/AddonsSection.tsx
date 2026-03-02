import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { AddonManager } from '@/components/dialogs/AddonManager';
import { Button } from '@/components/ui/button';

export default function AddonsSection() {
  const { t } = useTranslation();
  const [addonManagerOpen, setAddonManagerOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('toolbar.addons')}</h3>
        <p className="text-sm text-muted-foreground">{t('toolbar.tooltips.addons')}</p>
      </div>

      <Button onClick={() => setAddonManagerOpen(true)} className="gap-2">
        <Package className="h-4 w-4" />
        {t('addonManager.title')}
      </Button>

      <AddonManager open={addonManagerOpen} onClose={() => setAddonManagerOpen(false)} />
    </div>
  );
}
