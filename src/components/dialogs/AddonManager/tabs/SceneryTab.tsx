// src/components/dialogs/AddonManager/tabs/SceneryTab.tsx
import { useEffect, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  AlertCircle,
  ArrowUpDown,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SceneryEntry } from '@/lib/addonManager/core/types';
import {
  useScenarySaveOrder,
  useSceneryBackups,
  useSceneryList,
  useSceneryRestore,
  useScenerySort,
  useSceneryToggle,
} from '@/queries/useAddonManager';
import { SortableSceneryEntry } from '../components/SceneryEntry';

export function SceneryTab() {
  const { data: entries = [], isLoading, error } = useSceneryList();
  const sortMutation = useScenerySort();
  const saveOrderMutation = useScenarySaveOrder();
  const toggleMutation = useSceneryToggle();
  const { data: backups = [] } = useSceneryBackups();
  const restoreMutation = useSceneryRestore();

  const [localEntries, setLocalEntries] = useState<SceneryEntry[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [safeMode, setSafeMode] = useState(true);

  // Sync local state when remote data changes
  useEffect(() => {
    if (entries.length > 0 && !hasUnsavedChanges) {
      setLocalEntries(entries);
    }
  }, [entries, hasUnsavedChanges]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleOpenFolder = (fullPath: string) => {
    window.appAPI.openPath(fullPath);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localEntries.findIndex((e) => e.folderName === active.id);
      const newIndex = localEntries.findIndex((e) => e.folderName === over.id);

      // In safe mode, only allow reorder within same priority tier
      if (safeMode && localEntries[oldIndex].priority !== localEntries[newIndex].priority) {
        return; // Block cross-category drag in safe mode
      }

      setLocalEntries(arrayMove(localEntries, oldIndex, newIndex));
      setHasUnsavedChanges(true);
    }
  };

  const handleSaveOrder = async () => {
    // Save the current order to file
    const folderNames = localEntries.map((e) => e.folderName);
    await saveOrderMutation.mutateAsync(folderNames);
    setHasUnsavedChanges(false);
  };

  const handleAutoSort = async () => {
    await sortMutation.mutateAsync();
    setHasUnsavedChanges(false);
  };

  const handleRestore = async (backupPath: string) => {
    await restoreMutation.mutateAsync(backupPath);
    setShowBackups(false);
    setHasUnsavedChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Scanning scenery folders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load scenery'}
        </AlertDescription>
      </Alert>
    );
  }

  const isPending =
    sortMutation.isPending ||
    saveOrderMutation.isPending ||
    toggleMutation.isPending ||
    restoreMutation.isPending;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {localEntries.length} scenery packages
          </span>
          {hasUnsavedChanges && <span className="text-xs text-warning">Unsaved changes</span>}

          {/* Safe mode toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  {safeMode ? (
                    <ShieldCheck className="h-4 w-4 text-success" />
                  ) : (
                    <ShieldOff className="h-4 w-4 text-warning" />
                  )}
                  <Switch id="safe-mode" checked={safeMode} onCheckedChange={setSafeMode} />
                  <Label htmlFor="safe-mode" className="cursor-pointer text-xs">
                    Safe mode
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[250px]">
                <p className="text-xs">
                  {safeMode
                    ? 'Drag restricted to same category. Turn off to freely reorder (advanced).'
                    : 'Free reorder enabled. Items can be dragged across categories - use with caution!'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <Button variant="default" size="sm" onClick={handleSaveOrder} disabled={isPending}>
              {saveOrderMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Order
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleAutoSort} disabled={isPending}>
            {sortMutation.isPending && !hasUnsavedChanges ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpDown className="mr-2 h-4 w-4" />
            )}
            Auto-Sort
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBackups(true)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Backups ({backups.length})
          </Button>
        </div>
      </div>

      {/* Drag hint */}
      <p className="text-xs text-muted-foreground">
        {safeMode
          ? 'Drag to reorder within the same category. Changes are saved when you click Save Order.'
          : '⚠️ Safe mode OFF - You can drag items across categories. This may cause scenery issues if done incorrectly.'}
      </p>

      {/* Scenery list with drag-and-drop */}
      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={localEntries.map((e) => e.folderName)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 pr-4">
              {localEntries.map((entry) => (
                <SortableSceneryEntry
                  key={entry.folderName}
                  entry={entry}
                  onToggle={(name) => toggleMutation.mutate(name)}
                  onOpenFolder={handleOpenFolder}
                  disabled={isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>

      {/* Backups Dialog */}
      <Dialog open={showBackups} onOpenChange={setShowBackups}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scenery Backups</DialogTitle>
            <DialogDescription>Restore a previous version of scenery_packs.ini</DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto">
            {backups.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No backups available yet. Backups are created automatically when you save changes.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {backups.map((backup) => (
                  <div
                    key={backup.path}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <span className="text-sm">{new Date(backup.timestamp).toLocaleString()}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(backup.path)}
                      disabled={restoreMutation.isPending}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Restore'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
