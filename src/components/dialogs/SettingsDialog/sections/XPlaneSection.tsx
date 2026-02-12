import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, FolderOpen, Loader2, Plane } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { SettingsSectionProps } from '../types';

export default function XPlaneSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const [xplanePath, setXplanePath] = useState<string | null>(null);
  const [detectedPaths, setDetectedPaths] = useState<string[]>([]);
  const [pathLoading, setPathLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPath();
  }, []);

  async function loadPath() {
    try {
      const path = await window.xplaneAPI.getPath();
      setXplanePath(path);
      const detected = await window.xplaneAPI.detectInstallations();
      setDetectedPaths([...new Set(detected)]);
    } catch {
      setError('Failed to detect X-Plane installations');
    }
  }

  const handleBrowse = async () => {
    setPathLoading(true);
    setError(null);
    try {
      const result = await window.xplaneAPI.browseForPath();
      if (result?.valid && result.path !== xplanePath) {
        await window.xplaneAPI.setPath(result.path);
        window.location.reload();
      }
    } catch {
      setError(t('settings.xplane.setPathFailed', 'Failed to set X-Plane path'));
    } finally {
      setPathLoading(false);
    }
  };

  const handleSelectPath = async (path: string) => {
    if (path === xplanePath) return;
    setPathLoading(true);
    setError(null);
    try {
      const validation = await window.xplaneAPI.validatePath(path);
      if (validation.valid) {
        await window.xplaneAPI.setPath(path);
        window.location.reload();
      } else {
        setError(t('settings.xplane.invalidInstallation', 'Invalid X-Plane installation'));
      }
    } catch {
      setError(t('settings.xplane.validationFailed', 'Failed to validate X-Plane path'));
    } finally {
      setPathLoading(false);
    }
  };

  // Check if current path is a custom one (not in detected list)
  const isCustomPath = xplanePath && !detectedPaths.includes(xplanePath);

  // Build unified list: detected paths + custom path if any
  const allPaths = isCustomPath ? [xplanePath, ...detectedPaths] : detectedPaths;

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

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Installations List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('settings.xplane.detectedInstallations')}
          </CardTitle>
          {allPaths.length > 1 && (
            <CardDescription>{t('settings.xplane.selectInstallation')}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {allPaths.length > 0 ? (
            allPaths.map((path) => {
              const isSelected = path === xplanePath;
              const isCustom = path === xplanePath && isCustomPath;
              return (
                <div
                  key={path}
                  className={cn(
                    'flex h-auto w-full items-center gap-3 rounded-md border px-4 py-3',
                    isSelected
                      ? 'border-success/50 bg-success/10'
                      : 'cursor-pointer border-border bg-background hover:bg-accent hover:text-accent-foreground',
                    pathLoading && !isSelected && 'pointer-events-none opacity-50'
                  )}
                  onClick={() => !isSelected && !pathLoading && handleSelectPath(path)}
                >
                  <div
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full transition-colors',
                      isSelected ? 'bg-success' : 'bg-muted-foreground/30'
                    )}
                  />
                  <span className="flex-1 truncate text-left font-mono text-sm">{path}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {isCustom && (
                      <Badge variant="outline" className="text-xs">
                        {t('settings.xplane.custom', 'Custom')}
                      </Badge>
                    )}
                    {isSelected && (
                      <Badge variant="success" className="gap-1">
                        <Check className="h-3 w-3" />
                        {t('settings.xplane.active', 'Active')}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('setup.noInstallations')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Browse Button */}
      <Button variant="outline" onClick={handleBrowse} disabled={pathLoading} className="gap-2">
        {pathLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FolderOpen className="h-4 w-4" />
        )}
        {t('setup.browseManually')}
      </Button>
    </div>
  );
}
