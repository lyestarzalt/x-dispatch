// src/components/dialogs/AddonManager/tabs/SceneryTab.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Boxes,
  Check,
  Globe,
  GripVertical,
  History,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Undo2,
  X,
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import type { SceneryEntry, SceneryPriority } from '@/lib/addonManager/core/types';
import {
  buildSmartGroups,
  customGroupMembers,
  effectivePriority,
} from '@/lib/addonManager/scenery/groups';
import { errorMessage } from '@/lib/utils/errors';
import { cn } from '@/lib/utils/helpers';
import { toastError } from '@/lib/utils/toastError';
import {
  useScenarySaveOrder,
  useSceneryBackups,
  useSceneryDelete,
  useSceneryList,
  useSceneryRestore,
  useScenerySetEnabled,
  useScenerySort,
  useSceneryToggle,
} from '@/queries/useAddonManager';
import { useXPlanePath } from '@/queries/useAppQuery';
import { sceneryPrefsFor, useSceneryPrefsStore } from '@/stores/sceneryPrefsStore';
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
        isDragging && 'border-primary bg-card shadow-primary/10 z-50 shadow-xl'
      )}
    >
      <div
        className={cn(
          'bg-muted/50 text-muted-foreground flex h-7 items-center justify-center rounded-md font-mono text-sm font-semibold tabular-nums',
          isDragging && 'bg-primary/20 text-primary'
        )}
        style={{ minWidth: `${positionWidth + 0.5}rem` }}
      >
        {position}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        {...attributes}
        {...listeners}
        className={cn(
          'text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground cursor-grab',
          isDragging && 'text-primary cursor-grabbing'
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

      <Globe className="text-primary h-4 w-4" />

      <div className="min-w-0 flex-1">
        <span className="text-primary block truncate text-sm font-medium">
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
  const [freeReorder, setFreeReorder] = useState(false);
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPrefix, setNewGroupPrefix] = useState('');
  const setEnabledMutation = useScenerySetEnabled();

  // The user's own tiers and groups for this X-Plane folder
  const { data: xplanePath = null } = useXPlanePath();
  const prefs = useSceneryPrefsStore((s) => sceneryPrefsFor(s, xplanePath));
  const setCategoryOverride = useSceneryPrefsStore((s) => s.setCategoryOverride);
  const addCustomGroup = useSceneryPrefsStore((s) => s.addCustomGroup);
  const removeCustomGroup = useSceneryPrefsStore((s) => s.removeCustomGroup);
  const overrides = prefs.categoryOverrides;

  // Sync local state when remote data changes. We need a local fork so the
  // user can stage reorders/toggles before saving back.
  useEffect(() => {
    if (entries.length > 0 && !hasUnsavedChanges) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalEntries(entries);
    }
  }, [entries, hasUnsavedChanges]);

  // Count stats
  const stats = useMemo(() => {
    const enabled = localEntries.filter((e) => e.enabled).length;
    const disabled = localEntries.length - enabled;
    const conflicts = localEntries.filter((e) => e.conflicts).length;
    return { total: localEntries.length, enabled, disabled, conflicts };
  }, [localEntries]);

  // Families of packs that switch together: read off the names, plus the user's own
  const groups = useMemo(() => {
    const smart = buildSmartGroups(localEntries).map((g) => ({
      key: g.key,
      label: g.label,
      custom: null as string | null,
      members: g.members,
    }));
    const custom = prefs.customGroups.map((g) => ({
      key: `custom:${g.id}`,
      label: g.name,
      custom: g.id,
      members: customGroupMembers(g, localEntries),
    }));
    return [...custom, ...smart];
  }, [localEntries, prefs.customGroups]);
  const groupMembers = useMemo(
    () => new Set(groups.find((g) => g.key === activeGroup)?.members.map((m) => m.folderName)),
    [groups, activeGroup]
  );

  // Filter by search query, the conflicts switch and the chosen group (show all if empty)
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const group = activeGroup && groups.some((g) => g.key === activeGroup);
    if (!q && !conflictsOnly && !group) return localEntries;
    return localEntries.filter(
      (e) =>
        e.isGlobalAirports ||
        ((!q || e.folderName.toLowerCase().includes(q)) &&
          (!conflictsOnly || e.conflicts) &&
          (!group || groupMembers.has(e.folderName)))
    );
  }, [localEntries, searchQuery, conflictsOnly, activeGroup, groups, groupMembers]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Stable references so the memoized rows only re-render when their own
  // entry, position or disabled state changes.
  const { mutate: toggleMutate } = toggleMutation;
  const handleToggle = useCallback((name: string) => toggleMutate(name), [toggleMutate]);
  const handleDeleteRequest = useCallback((name: string) => setDeleteTarget(name), []);
  const handleOpenFolder = useCallback((fullPath: string) => {
    window.appAPI.openPath(fullPath);
  }, []);
  const handleSelect = useCallback((name: string, isSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);
  const handleSetCategory = useCallback(
    (name: string, tier: SceneryPriority | null) => {
      if (xplanePath) setCategoryOverride(xplanePath, name, tier);
    },
    [xplanePath, setCategoryOverride]
  );
  const { mutateAsync: setEnabledAsync } = setEnabledMutation;
  const setManyEnabled = useCallback(
    async (folderNames: string[], enabled: boolean) => {
      if (folderNames.length === 0) return;
      try {
        await setEnabledAsync({ folderNames, enabled });
      } catch (e) {
        toastError('addon_manager', errorMessage(e));
      }
    },
    [setEnabledAsync]
  );
  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!xplanePath || !name) return;
    const prefix = newGroupPrefix.trim();
    const id = addCustomGroup(xplanePath, {
      name,
      members: [...selected],
      ...(prefix ? { rule: { mode: 'prefix' as const, pattern: prefix } } : {}),
    });
    setNewGroupOpen(false);
    setNewGroupName('');
    setNewGroupPrefix('');
    setSelected(new Set());
    setActiveGroup(`custom:${id}`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localEntries.findIndex((e) => e.folderName === active.id);
      const newIndex = localEntries.findIndex((e) => e.folderName === over.id);

      // By default a pack stays inside its priority tier; free reorder lifts that.
      const oldEntry = localEntries[oldIndex];
      const newEntry = localEntries[newIndex];
      if (!oldEntry || !newEntry) return;
      if (
        !freeReorder &&
        effectivePriority(oldEntry, overrides) !== effectivePriority(newEntry, overrides)
      )
        return;

      setLocalEntries(arrayMove(localEntries, oldIndex, newIndex));
      setHasUnsavedChanges(true);
    }
  };

  const handleSaveOrder = async () => {
    const folderNames = localEntries.map((e) => e.folderName);
    try {
      await saveOrderMutation.mutateAsync(folderNames);
      setHasUnsavedChanges(false);
    } catch (e) {
      toastError('addon_manager', errorMessage(e));
    }
  };

  const handleDiscard = () => {
    setLocalEntries(entries);
    setHasUnsavedChanges(false);
  };

  const handleAutoSort = async () => {
    try {
      await sortMutation.mutateAsync(overrides);
      setHasUnsavedChanges(false);
    } catch (e) {
      toastError('addon_manager', errorMessage(e));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success(t('addonManager.scenery.deleted', { name: deleteTarget }));
    } catch (err) {
      toastError(
        'addon_manager',
        err instanceof Error ? err.message : t('addonManager.scenery.deleteFailed')
      );
    }
    setDeleteTarget(null);
  };

  const handleRestore = async (backupPath: string) => {
    try {
      await restoreMutation.mutateAsync(backupPath);
      setShowBackups(false);
      setHasUnsavedChanges(false);
    } catch (e) {
      toastError('addon_manager', errorMessage(e));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="border-primary/20 h-16 w-16 rounded-full border-2" />
          <Spinner className="text-primary absolute inset-0 m-auto size-8" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{t('addonManager.scenery.loading')}</p>
          <p className="text-muted-foreground mt-1 text-sm">
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

  const isBatching = setEnabledMutation.isPending;
  const isPending =
    sortMutation.isPending ||
    saveOrderMutation.isPending ||
    toggleMutation.isPending ||
    deleteMutation.isPending ||
    restoreMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
        {/* Left: stats + status */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {t('addonManager.scenery.tabStats', {
              total: stats.total,
              enabled: stats.enabled,
              disabled: stats.disabled,
            })}
          </span>
          {hasUnsavedChanges && (
            <span className="text-warning flex items-center gap-1.5 text-xs font-medium">
              <span className="bg-warning h-1.5 w-1.5 animate-pulse rounded-full" />
              {t('addonManager.scenery.unsavedChanges')}
            </span>
          )}
          {stats.conflicts > 0 && (
            <Button
              variant={conflictsOnly ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setConflictsOnly((v) => !v)}
              aria-pressed={conflictsOnly}
              className="text-warning gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              {t('addonManager.scenery.conflicts.filter', { count: stats.conflicts })}
            </Button>
          )}
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Switch
              checked={freeReorder}
              onCheckedChange={setFreeReorder}
              className="scale-75"
              aria-label={t('addonManager.scenery.freeReorder')}
            />
            {t('addonManager.scenery.freeReorder')}
          </label>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {/* Save and discard — only while dirty */}
          {hasUnsavedChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                disabled={isPending}
                className="gap-1.5"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t('addonManager.scenery.discardOrder')}
              </Button>
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
            </>
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
                  toast.success(parts.join(', '));
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
            className="text-muted-foreground gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isScanning && 'animate-spin')} />
            {t('addonManager.rescan')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBackups(true)}
            className="text-muted-foreground h-8 w-8"
            tooltip={t('addonManager.scenery.backupsTitle')}
          >
            <History className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="border-border border-b px-4 py-2">
        <Input
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
          startIcon={<Search />}
        />
      </div>

      {/* Groups: families of packs that switch together */}
      {(groups.length > 0 || selected.size > 0) && (
        <div className="border-border flex items-center gap-2 overflow-x-auto border-b px-4 py-2">
          <Boxes className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <Button
            variant={activeGroup === null ? 'secondary' : 'ghost'}
            size="xs"
            className="shrink-0"
            onClick={() => setActiveGroup(null)}
          >
            {t('addonManager.scenery.groups.all')}
          </Button>
          {groups.map((group) => {
            const on = group.members.filter((m) => m.enabled).length;
            return (
              <div
                key={group.key}
                className={cn(
                  'border-border flex shrink-0 items-center gap-1.5 rounded-md border pr-1.5',
                  activeGroup === group.key && 'border-primary/50 bg-primary/5'
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-1.5 px-2 py-1 text-xs"
                  onClick={() => setActiveGroup(activeGroup === group.key ? null : group.key)}
                  title={group.members.map((m) => m.folderName).join('\n')}
                >
                  <span className="max-w-40 truncate">{group.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t('addonManager.scenery.groups.state', { on, total: group.members.length })}
                  </span>
                </button>
                <Switch
                  checked={on === group.members.length}
                  onCheckedChange={(checked) =>
                    setManyEnabled(
                      group.members.map((m) => m.folderName),
                      checked
                    )
                  }
                  disabled={isPending || isBatching}
                  className="scale-75"
                  aria-label={group.label}
                />
                {group.custom && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-5 w-5"
                    onClick={() => {
                      if (xplanePath) removeCustomGroup(xplanePath, group.custom!);
                      if (activeGroup === group.key) setActiveGroup(null);
                    }}
                    tooltip={t('addonManager.scenery.groups.remove')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
          {selected.size > 0 && (
            <>
              <span className="bg-border mx-1 h-5 w-px shrink-0" />
              <span className="text-muted-foreground shrink-0 text-xs">
                {t('addonManager.scenery.selection.count', { count: selected.size })}
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                disabled={isPending || isBatching}
                onClick={() => setManyEnabled([...selected], true)}
              >
                {t('addonManager.scenery.selection.enable')}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                disabled={isPending || isBatching}
                onClick={() => setManyEnabled([...selected], false)}
              >
                {t('addonManager.scenery.selection.disable')}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                disabled={!xplanePath}
                onClick={() => setNewGroupOpen(true)}
              >
                <Plus className="h-3 w-3" />
                {t('addonManager.scenery.selection.group')}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                onClick={() => setSelected(new Set())}
              >
                {t('addonManager.scenery.selection.clear')}
              </Button>
            </>
          )}
        </div>
      )}

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
                    onToggle={handleToggle}
                    onOpenFolder={handleOpenFolder}
                    onDelete={handleDeleteRequest}
                    disabled={isPending}
                    priority={effectivePriority(entry, overrides)}
                    overridden={entry.folderName in overrides}
                    onSetCategory={handleSetCategory}
                    selected={selected.has(entry.folderName)}
                    selecting={selected.size > 0}
                    onSelect={handleSelect}
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
      </ScrollArea>

      {/* New custom group */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addonManager.scenery.groups.newTitle')}</DialogTitle>
            <DialogDescription>{t('addonManager.scenery.groups.newDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="scenery-group-name">{t('addonManager.scenery.groups.name')}</Label>
              <Input
                id="scenery-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t('addonManager.scenery.groups.namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scenery-group-prefix">
                {t('addonManager.scenery.groups.prefix')}
              </Label>
              <Input
                id="scenery-group-prefix"
                value={newGroupPrefix}
                onChange={(e) => setNewGroupPrefix(e.target.value)}
                placeholder={t('addonManager.scenery.groups.prefixPlaceholder')}
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setNewGroupOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              {t('addonManager.scenery.groups.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                <History className="text-muted-foreground/30 mb-3 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  {t('addonManager.scenery.noBackups')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {backups.map((backup, index) => (
                  <div
                    key={backup.path}
                    className="border-border bg-card/50 hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-muted flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tabular-nums">
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
