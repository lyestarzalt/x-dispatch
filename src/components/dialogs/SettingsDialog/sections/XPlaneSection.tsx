import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, FolderOpen, Loader2, Plane } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import { useXPlanePath } from '@/queries';
import type { SettingsSectionProps } from '../types';

export default function XPlaneSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { data: xplanePath } = useXPlanePath();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = async () => {
    setLoading(true);
    setError(null);
    window.appAPI.log.info('XPlaneSection: handleBrowse called');
    try {
      window.appAPI.log.info('XPlaneSection: calling browseForPath');
      const result = await window.xplaneAPI.browseForPath();
      window.appAPI.log.info(`XPlaneSection: browseForPath returned: ${JSON.stringify(result)}`);
      if (result?.valid && result.path !== xplanePath) {
        const changeResult = await window.xplaneAPI.changePath(result.path);
        if (!changeResult.success) {
          setError(changeResult.errors?.[0] || 'Failed to change path');
          setLoading(false);
        }
        // App will restart on success
      } else if (result && !result.valid) {
        setError(result.errors.join(', '));
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      window.appAPI.log.error(`XPlaneSection: Browse failed - ${errorMsg}`, err);
      setError(errorMsg || 'Failed to open folder picker');
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Plane className="h-5 w-5" />
          {t('settings.xplane.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.xplane.description')}</p>
      </div>

      <Separator />

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Path */}
      {xplanePath && (
        <div className="rounded-lg border border-success/50 bg-success/10 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">
              {xplanePath.split('/').pop() || xplanePath.split('\\').pop()}
            </span>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{xplanePath}</p>
        </div>
      )}

      {/* Browse Button */}
      <Button variant="outline" onClick={handleBrowse} disabled={loading} className="gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FolderOpen className="h-4 w-4" />
        )}
        {t('setup.changeFolder')}
      </Button>
    </div>
  );
}
