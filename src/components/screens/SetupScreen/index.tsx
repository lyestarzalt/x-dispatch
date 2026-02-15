import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import { AppLogo } from '@/components/ui/AppLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAppVersion } from '@/hooks/useAppVersion';

interface SetupScreenProps {
  onComplete: () => void;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const { t } = useTranslation();
  const version = useAppVersion();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBrowse = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.xplaneAPI.browseForPath();
      if (result?.valid) {
        setSelectedPath(result.path);
      } else if (result) {
        setError(result.errors.join(', '));
      }
    } catch (err) {
      window.appAPI.log.error('Browse failed', err);
      setError(t('setup.failedToBrowse'));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.xplaneAPI.setPath(selectedPath);
      if (result.success) {
        onComplete();
      } else {
        setError(result.errors.join(', '));
      }
    } catch {
      setError(t('setup.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <AppLogo size="md" className="mx-auto mb-4" />
          <h1 className="xp-page-heading mb-2 text-2xl">{t('setup.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('setup.subtitle')}</p>
        </div>

        {/* Selected path display */}
        {selectedPath && (
          <div className="mb-6 rounded-lg border border-success/50 bg-success/10 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">
                {selectedPath.split('/').pop() || selectedPath.split('\\').pop()}
              </span>
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">{selectedPath}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={handleBrowse}
            disabled={loading}
            className="w-full gap-2"
          >
            {loading && !selectedPath ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            {selectedPath ? t('setup.changeFolder') : t('setup.selectFolder')}
          </Button>

          {selectedPath && (
            <Button onClick={handleContinue} disabled={loading} className="w-full gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {t('common.continue')}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Version */}
        <p className="mt-8 text-center font-mono text-xs text-muted-foreground/50">
          {version && `v${version}`}
        </p>
      </div>
    </div>
  );
}
