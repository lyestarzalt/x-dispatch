import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateCheck } from '@/queries';
import { Button } from './ui/button';

export function UpdateAvailableToast(): null {
  const { t } = useTranslation();
  const update = useUpdateCheck();

  useEffect(() => {
    if (!update.data?.available || !update.data.latestVersion) return;
    const { latestVersion, url } = update.data;
    toast.custom(
      (id) => (
        <div className="border-primary/20 bg-card flex items-start gap-3 rounded-lg border p-4 shadow-lg">
          <Download className="text-primary mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-medium">{t('update.available.title')}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('update.available.description', { version: latestVersion })}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  window.appAPI.openExternal(url);
                  toast.dismiss(id);
                }}
              >
                {t('update.available.download')}
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => toast.dismiss(id)}
              >
                {t('update.available.dismiss')}
              </Button>
            </div>
          </div>
        </div>
      ),
      { id: `update-available-${latestVersion}`, duration: Infinity, position: 'bottom-center' }
    );
  }, [update.data, t]);

  return null;
}
