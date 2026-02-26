// src/components/dialogs/AddonManager/components/ScriptsDialog.tsx
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/helpers';
import {
  useLuaScriptDelete,
  useLuaScriptList,
  useLuaScriptToggle,
} from '@/queries/useAddonManager';

interface ScriptsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ScriptsDialog({ open, onClose }: ScriptsDialogProps) {
  const { data: scripts = [], isLoading, error } = useLuaScriptList(open);
  const toggleMutation = useLuaScriptToggle();
  const deleteMutation = useLuaScriptDelete();

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete script "${fileName}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(fileName);
  };

  const isPending = toggleMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lua Scripts</DialogTitle>
          <DialogDescription>FlyWithLua Scripts folder</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load scripts'}
            </AlertDescription>
          </Alert>
        ) : scripts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No scripts found</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="flex flex-col gap-2 pr-4">
              {scripts.map((script) => (
                <div
                  key={script.fileName}
                  className={cn(
                    'flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2',
                    !script.enabled && 'bg-muted/30 opacity-60'
                  )}
                >
                  {/* Toggle */}
                  <Switch
                    checked={script.enabled}
                    onCheckedChange={() => toggleMutation.mutate(script.fileName)}
                    disabled={isPending}
                  />

                  {/* Name */}
                  <span className="flex-1 truncate font-mono text-sm">{script.displayName}</span>

                  {/* Extension indicator */}
                  <span className="text-xs text-muted-foreground">
                    {script.enabled ? '.lua' : '.xfml'}
                  </span>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(script.fileName)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
