// src/components/dialogs/AddonManager/components/LiveryDialog.tsx
import { AlertCircle, Loader2, Plane, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LiveryInfo } from '@/lib/addonManager/core/types';
import { useAircraftIcon, useLiveryDelete, useLiveryList } from '@/queries/useAddonManager';

interface LiveryItemProps {
  livery: LiveryInfo;
  onDelete: (folderName: string) => void;
  isPending: boolean;
}

function LiveryItem({ livery, onDelete, isPending }: LiveryItemProps) {
  const { data: iconSrc } = useAircraftIcon(livery.iconPath);

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
      {/* Icon preview */}
      {iconSrc ? (
        <img src={iconSrc} alt={livery.displayName} className="h-8 w-8 rounded object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
          <Plane className="h-4 w-4 text-muted-foreground/50" />
        </div>
      )}

      {/* Name */}
      <span className="flex-1 truncate text-sm">{livery.displayName}</span>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:bg-destructive/10"
        onClick={() => onDelete(livery.folderName)}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface LiveryDialogProps {
  open: boolean;
  onClose: () => void;
  aircraftFolder: string;
  aircraftName: string;
}

export function LiveryDialog({ open, onClose, aircraftFolder, aircraftName }: LiveryDialogProps) {
  const { data: liveries = [], isLoading, error } = useLiveryList(aircraftFolder, open);
  const deleteMutation = useLiveryDelete();

  const handleDelete = async (liveryFolder: string) => {
    if (!confirm(`Delete livery "${liveryFolder}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync({ aircraftFolder, liveryFolder });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Liveries</DialogTitle>
          <DialogDescription>{aircraftName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load liveries'}
            </AlertDescription>
          </Alert>
        ) : liveries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No liveries found</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="flex flex-col gap-2 pr-4">
              {liveries.map((livery) => (
                <LiveryItem
                  key={livery.folderName}
                  livery={livery}
                  onDelete={handleDelete}
                  isPending={deleteMutation.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
