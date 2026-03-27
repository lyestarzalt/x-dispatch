// src/components/dialogs/AddonManager/tabs/SceneryTab.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  Check,
  Globe,
  GripVertical,
  History,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import type { SceneryEntry } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';
import {
  useScenarySaveOrder,
  useSceneryBackups,
  useSceneryDelete,
  useSceneryList,
  useSceneryRestore,
  useScenerySort,
  useSceneryToggle,
} from '@/queries/useAddonManager';
import { SortableSceneryEntry } from '../components/SceneryEntry';

function GlobalAirportsRow({
  entry,
  position,
  totalCount,
  onToggle,
  disabled,
}: {
  entry: SceneryEntry;
  position: number;
  totalCount: number;
  onToggle: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const positionWidth = Math.max(2, String(totalCount).length);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.folderName,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-dashed px-2 py-1.5',
        'transition-all duration-150',
        entry.enabled
          ? 'border-primary/30 bg-primary/5'
          : 'border-muted-foreground/20 bg-muted/10 opacity-50',
        isDragging && 'z-50 border-primary bg-card shadow-xl shadow-primary/10'
      )}
    >
      <div
        className={cn(
          'flex h-7 items-center justify-center rounded-md bg-muted/50 font-mono text-sm font-semibold tabular-nums text-muted-foreground',
          isDragging && 'bg-primary/20 text-primary'
        )}
        style={{ minWidth: `${positionWidth + 0.5}rem` }}
      >
        {position}
      </div>

      <Button
        variant="ghost"
        size="icon"
        {...attributes}
        {...listeners}
        className={cn(
          'h-7 w-7 cursor-grab text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground',
          isDragging && 'cursor-grabbing text-primary'
        )}
        disabled={disabled}
      >
        <GripVertical className="h-4 w-4" />
      </Button>

      <Switch
        checked={entry.enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="scale-90"
      />

      <Globe className="h-4 w-4 text-primary" />

      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-primary">
          {t('addonManager.scenery.globalAirports')}
        </span>
      </div>
    </div>
  );
}

export function SceneryTab() {
  const { t } = useTranslation();
  const { data: entries = [], isLoading, error, refetch: refetchScenery } = useSceneryList();
  const sortMutation = useScenerySort();
  const saveOrderMutation = useScenarySaveOrder();
  const toggleMutation = useSceneryToggle();
  const deleteMutation = useSceneryDelete();
  const { data: backups = [] } = useSceneryBackups();
  const restoreMutation = useSceneryRestore();

  const [localEntries, setLocalEntries] = useState<SceneryEntry[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showBackups, setShowBackups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Sync local state when remote data changes
  useEffect(() => {
    if (entries.length > 0 && !hasUnsavedChanges) {
      setLocalEntries(entries);
    }
  }, [entries, hasUnsavedChanges]);

  // Count stats
  const stats = useMemo(() => {
    const enabled = localEntries.filter((e) => e.enabled).length;
    const disabled = localEntries.length - enabled;
    return { total: localEntries.length, enabled, disabled };
  }, [localEntries]);

  // Filter by search query (show all if empty)
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return localEntries;
    const q = searchQuery.toLowerCase();
    return localEntries.filter((e) => e.folderName.toLowerCase().includes(q) || e.isGlobalAirports);
  }, [localEntries, searchQuery]);

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

      // Only allow reorder within the same priority tier
      const oldEntry = localEntries[oldIndex];
      const newEntry = localEntries[newIndex];
      if (!oldEntry || !newEntry || oldEntry.priority !== newEntry.priority) {
        return;
      }

      setLocalEntries(arrayMove(localEntries, oldIndex, newIndex));
      setHasUnsavedChanges(true);
    }
  };

  const handleSaveOrder = async () => {
    const folderNames = localEntries.map((e) => e.folderName);
    await saveOrderMutation.mutateAsync(folderNames);
    setHasUnsavedChanges(false);
  };

  const handleAutoSort = async () => {
    await sortMutation.mutateAsync();
    setHasUnsavedChanges(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success(t('addonManager.scenery.deleted', { name: deleteTarget }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('addonManager.scenery.deleteFailed'));
    }
    setDeleteTarget(null);
  };

  const handleRestore = async (backupPath: string) => {
    await restoreMutation.mutateAsync(backupPath);
    setShowBackups(false);
    setHasUnsavedChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-primary/20" />
          <Spinner className="absolute inset-0 m-auto size-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{t('addonManager.scenery.loading')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('addonManager.scenery.loadingHint')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('addonManager.scenery.loadFailed')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPending =
    sortMutation.isPending ||
    saveOrderMutation.isPending ||
    toggleMutation.isPending ||
    deleteMutation.isPending ||
    restoreMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        {/* Left: stats + status */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{stats.total}</span>
            {' packs · '}
            <span className="text-success">{stats.enabled}</span>
            {' on · '}
            <span>{stats.disabled}</span>
            {' off'}
          </span>
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
              {t('addonManager.scenery.unsavedChanges')}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {/* Save — primary when dirty */}
          {hasUnsavedChanges && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveOrder}
              disabled={isPending}
              className="mr-1 gap-1.5"
            >
              {saveOrderMutation.isPending ? <Spinner /> : <Save className="h-3.5 w-3.5" />}
              {t('addonManager.scenery.saveOrder')}
            </Button>
          )}

          {/* Auto-sort */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoSort}
            disabled={isPending}
            className="gap-1.5"
          >
            {sortMutation.isPending ? <Spinner /> : <Sparkles className="h-3.5 w-3.5" />}
            {t('addonManager.scenery.autoSort')}
          </Button>

          {/* Rescan */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              setIsScanning(true);
              try {
                const before = entries.length;
                const { data } = await refetchScenery();
                const after = data?.length ?? before;
                const sceneryDiff = after - before;

                // Also resync custom scenery airports (fast — no global re-parse)
                const airportResult = await window.appAPI.resyncCustomAirports();

                const parts: string[] = [];
                if (sceneryDiff > 0)
                  parts.push(t('addonManager.rescanFound', { count: sceneryDiff }));
                else if (sceneryDiff < 0)
                  parts.push(t('addonManager.rescanRemoved', { count: Math.abs(sceneryDiff) }));

                if (airportResult.diff > 0)
                  parts.push(t('addonManager.rescanAirportsAdded', { count: airportResult.diff }));
                else if (airportResult.diff < 0)
                  parts.push(
                    t('addonManager.rescanAirportsRemoved', {
                      count: Math.abs(airportResult.diff),
                    })
                  );

                if (parts.length > 0) {
                  toast.success(parts.join(' · '));
                } else {
                  toast(t('addonManager.rescanNoChanges'), {
                    icon: <Check className="h-4 w-4" />,
                  });
                }
              } finally {
                setIsScanning(false);
              }
            }}
            disabled={isScanning}
            className="gap-1.5 text-muted-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isScanning && 'animate-spin')} />
            {t('addonManager.rescan')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBackups(true)}
            className="h-8 w-8 text-muted-foreground"
            tooltip={t('addonManager.scenery.backupsTitle')}
          >
            <History className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b border-border px-4 py-2">
        <Input
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
          startIcon={<Search />}
        />
      </div>

      {/* Scenery list */}
      <ScrollArea className="flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={filteredEntries.map((e) => e.folderName)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1 p-4">
              {filteredEntries.map((entry, index) =>
                entry.isGlobalAirports ? (
                  <GlobalAirportsRow
                    key="*GLOBAL_AIRPORTS*"
                    entry={entry}
                    position={index + 1}
                    totalCount={stats.total}
                    onToggle={() => toggleMutation.mutate(entry.folderName)}
                    disabled={isPending}
                  />
                ) : (
                  <SortableSceneryEntry
                    key={entry.folderName}
                    entry={entry}
                    position={index + 1}
                    totalCount={stats.total}
                    onToggle={(name) => toggleMutation.mutate(name)}
                    onOpenFolder={handleOpenFolder}
                    onDelete={(name) => setDeleteTarget(name)}
                    disabled={isPending}
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>

      {/* Backups Dialog */}
      <Dialog open={showBackups} onOpenChange={setShowBackups}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addonManager.scenery.backupsTitle')}</DialogTitle>
            <DialogDescription>{t('addonManager.scenery.backupsDescription')}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto">
            {backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {t('addonManager.scenery.noBackups')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {backups.map((backup, index) => (
                  <div
                    key={backup.path}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-sm">{new Date(backup.timestamp).toLocaleString()}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(backup.path)}
                      disabled={restoreMutation.isPending}
                    >
                      {restoreMutation.isPending ? <Spinner /> : t('addonManager.scenery.restore')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addonManager.scenery.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('addonManager.scenery.deleteDescription', { name: deleteTarget })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Spinner /> : t('addonManager.scenery.deleteConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
