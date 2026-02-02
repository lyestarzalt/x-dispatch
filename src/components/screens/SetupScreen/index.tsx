import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, FolderOpen, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppVersion } from '@/hooks/useAppVersion';

interface SetupScreenProps {
  onComplete: () => void;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const { t } = useTranslation();
  const version = useAppVersion();
  const [detectedPaths, setDetectedPaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [customPath, setCustomPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    async function detect() {
      try {
        const paths = await window.xplaneAPI.detectInstallations();
        setDetectedPaths(paths);
        if (paths.length === 1) setSelectedPath(paths[0]);
      } catch {
        // Detection failed, user can browse manually
      } finally {
        setDetecting(false);
      }
    }
    detect();
  }, []);

  const handleBrowse = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.xplaneAPI.browseForPath();
      if (result?.valid) {
        setCustomPath(result.path);
        setSelectedPath(result.path);
      } else if (result) {
        setError(result.errors.join(', '));
      }
    } catch {
      setError(t('setup.failedToBrowse'));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedPath) return;
    setLoading(true);
    try {
      const result = await window.xplaneAPI.setPath(selectedPath);
      if (result.success) onComplete();
      else setError(result.errors.join(', '));
    } catch {
      setError(t('setup.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  const allPaths = [...detectedPaths];
  if (customPath && !detectedPaths.includes(customPath)) allPaths.push(customPath);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-light tracking-tight">{t('setup.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('setup.subtitle')}</p>
        </div>

        {/* Path selection */}
        <div className="mb-8">
          {detecting ? (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('setup.scanning')}</span>
            </div>
          ) : allPaths.length > 0 ? (
            <RadioGroup value={selectedPath} onValueChange={setSelectedPath}>
              <div className="space-y-3">
                {allPaths.map((path) => (
                  <Label
                    key={path}
                    htmlFor={path}
                    className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors ${
                      selectedPath === path
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={path} id={path} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {path.split('/').pop() || path.split('\\').pop()}
                        </span>
                        {selectedPath === path && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t('common.selected')}
                          </Badge>
                        )}
                      </div>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {path}
                      </span>
                    </div>
                    {selectedPath === path && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </Label>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p className="mb-2 text-sm">{t('setup.noInstallations')}</p>
              <p className="text-xs">{t('setup.selectManually')}</p>
            </div>
          )}
        </div>

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
            {t('setup.browseManually')}
          </Button>

          <Button
            onClick={handleContinue}
            disabled={!selectedPath || loading}
            className="w-full gap-2"
          >
            {loading && selectedPath ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {t('common.continue')}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* Version */}
        <p className="mt-10 text-center font-mono text-[10px] text-muted-foreground/50">
          {version && `v${version}`}
        </p>
      </div>
    </div>
  );
}
