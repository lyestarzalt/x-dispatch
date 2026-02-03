import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, FolderOpen, Loader2, Plane } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
    } catch (err) {
      setError('Failed to detect X-Plane installations');
    }
  }

  const handleBrowse = async () => {
    setPathLoading(true);
    setError(null);
    try {
      const result = await window.xplaneAPI.browseForPath();
      if (result?.valid) {
        setXplanePath(result.path);
        await window.xplaneAPI.setPath(result.path);
      }
    } catch {
      setError('Failed to set X-Plane path');
    } finally {
      setPathLoading(false);
    }
  };

  const handleSelectPath = async (path: string) => {
    setPathLoading(true);
    setError(null);
    try {
      const validation = await window.xplaneAPI.validatePath(path);
      if (validation.valid) {
        await window.xplaneAPI.setPath(path);
        setXplanePath(path);
      } else {
        setError('Invalid X-Plane installation');
      }
    } catch {
      setError('Failed to validate X-Plane path');
    } finally {
      setPathLoading(false);
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

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Installation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('settings.xplane.currentPath')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            {xplanePath ? (
              <>
                <Check className="h-4 w-4 shrink-0 text-success" />
                <span className="flex-1 truncate font-mono text-sm">{xplanePath}</span>
                <Badge variant="outline" className="shrink-0">
                  X-Plane 12
                </Badge>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{t('common.notConfigured')}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detected Installations */}
      {detectedPaths.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {t('settings.xplane.detectedInstallations')}
            </CardTitle>
            <CardDescription>{t('settings.xplane.selectInstallation')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detectedPaths.map((path) => {
              const isSelected = path === xplanePath;
              return (
                <Button
                  key={path}
                  variant={isSelected ? 'secondary' : 'outline'}
                  className="h-auto w-full justify-start gap-3 py-3"
                  disabled={pathLoading || isSelected}
                  onClick={() => handleSelectPath(path)}
                >
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-full transition-colors',
                      isSelected ? 'bg-success' : 'bg-muted-foreground/30'
                    )}
                  />
                  <span className="flex-1 truncate text-left font-mono text-sm">{path}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-success" />}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}

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
