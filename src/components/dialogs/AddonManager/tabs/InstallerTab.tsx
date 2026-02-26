// src/components/dialogs/AddonManager/tabs/InstallerTab.tsx
import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DetectedItem } from '@/lib/addonManager/installer/types';
import { useInstallerAnalyze } from '@/queries/useAddonManager';
import { DetectedItemCard } from '../components/DetectedItemCard';
import { DropZone } from '../components/DropZone';

export function InstallerTab() {
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const analyzeMutation = useInstallerAnalyze();

  const handleFilesDropped = async (paths: string[]) => {
    try {
      const items = await analyzeMutation.mutateAsync(paths);
      setDetectedItems(items);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleClear = () => {
    setDetectedItems([]);
    analyzeMutation.reset();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <DropZone onFilesDropped={handleFilesDropped} disabled={analyzeMutation.isPending} />

      {analyzeMutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm">Analyzing...</span>
        </div>
      )}

      {analyzeMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {analyzeMutation.error instanceof Error
              ? analyzeMutation.error.message
              : 'Failed to analyze files'}
          </AlertDescription>
        </Alert>
      )}

      {detectedItems.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Detected {detectedItems.length} addon{detectedItems.length !== 1 ? 's' : ''}
            </h3>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="flex flex-col gap-2 pr-4">
              {detectedItems.map((item) => (
                <DetectedItemCard key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>

          <Button className="w-full" disabled>
            Install {detectedItems.length} addon{detectedItems.length !== 1 ? 's' : ''} (Coming in
            Phase 2)
          </Button>
        </>
      )}

      {detectedItems.length === 0 && !analyzeMutation.isPending && !analyzeMutation.isError && (
        <p className="text-center text-sm text-muted-foreground">
          Drop addon archives to analyze them
        </p>
      )}
    </div>
  );
}
