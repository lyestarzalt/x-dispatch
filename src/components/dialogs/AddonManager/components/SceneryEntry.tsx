// src/components/dialogs/AddonManager/components/SceneryEntry.tsx
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, FolderOpen, GripVertical, Layers, Power, Tag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type SceneryEntry, SceneryPriority } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';
import { MissingLibraryLinks } from './MissingLibraryLinks';
import { PriorityBadge } from './PriorityBadge';
import { SceneryConflictList } from './SceneryConflictList';

interface SortableSceneryEntryProps {
  entry: SceneryEntry;
  position: number;
  totalCount: number;
  onToggle: (folderName: string) => void;
  onOpenFolder: (fullPath: string) => void;
  onDelete: (folderName: string) => void;
  disabled: boolean;
  /** The tier the row shows and sorts by: the user's choice when set. */
  priority: SceneryPriority;
  /** The user filed this pack under a tier themselves. */
  overridden: boolean;
  onSetCategory: (folderName: string, tier: SceneryPriority | null) => void;
  selected: boolean;
  /** Any row is selected, so every row shows its checkbox. */
  selecting: boolean;
  onSelect: (folderName: string, selected: boolean) => void;
}

/** Tiers a user may file a pack under, with their badge text; Global Airports has its own row. */
const CHOOSABLE_TIERS: Array<[SceneryPriority, string | { literal: string }]> = [
  [SceneryPriority.FixedHighPriority, { literal: 'SAM' }],
  [SceneryPriority.Airport, 'airports'],
  [SceneryPriority.Library, 'libraries'],
  [SceneryPriority.Other, 'other'],
  [SceneryPriority.Overlay, 'overlays'],
  [SceneryPriority.AirportMesh, 'airportMesh'],
  [SceneryPriority.Mesh, 'mesh'],
];

// Memoized: the tab re-renders on every keystroke in the search box and on
// every mutation flag flip, and scenery lists run to hundreds of rows.
export const SortableSceneryEntry = memo(function SortableSceneryEntry({
  entry,
  position,
  totalCount,
  onToggle,
  onOpenFolder,
  onDelete,
  disabled,
  priority,
  overridden,
  onSetCategory,
  selected,
  selecting,
  onSelect,
}: SortableSceneryEntryProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.folderName,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate position width based on total count digits
  const positionWidth = Math.max(2, String(totalCount).length);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'group border-border/50 bg-card/50 flex items-center gap-2 rounded-lg border px-2 py-1.5',
            'transition-all duration-150',
            !entry.enabled && 'bg-muted/20 opacity-50',
            isDragging && 'border-primary bg-card shadow-primary/10 z-50 shadow-xl',
            !isDragging && 'hover:border-border hover:bg-card'
          )}
        >
          {/* Selection for batch actions */}
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(entry.folderName, checked === true)}
            aria-label={t('addonManager.scenery.selection.select')}
            className={cn(
              'transition-opacity',
              selected || selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          />

          {/* Position number */}
          <div
            className={cn(
              'bg-muted/50 text-muted-foreground flex h-7 items-center justify-center rounded-md font-mono text-sm font-semibold tabular-nums',
              isDragging && 'bg-primary/20 text-primary'
            )}
            style={{ minWidth: `${positionWidth + 0.5}rem` }}
          >
            {position}
          </div>

          {/* Drag handle */}
          <Button
            variant="ghost"
            size="icon-sm"
            {...attributes}
            {...listeners}
            className={cn(
              'cursor-grab',
              'text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground',
              isDragging && 'text-primary cursor-grabbing'
            )}
            disabled={disabled}
          >
            <GripVertical className="h-4 w-4" />
          </Button>

          {/* Enable/disable toggle */}
          <div className="flex items-center">
            <Switch
              checked={entry.enabled}
              onCheckedChange={() => onToggle(entry.folderName)}
              disabled={disabled}
              className="scale-90"
            />
          </div>

          {/* Priority badge */}
          <span
            className={cn(overridden && 'ring-primary/50 rounded-md ring-1')}
            title={overridden ? t('addonManager.scenery.category.byYou') : undefined}
          >
            <PriorityBadge priority={priority} />
          </span>

          {/* Folder name */}
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate font-mono text-sm',
                entry.enabled ? 'text-foreground' : 'text-muted-foreground'
              )}
              title={entry.folderName}
            >
              {entry.folderName}
            </span>
          </div>

          {/* Libraries the pack needs that are not installed */}
          {entry.missingLibraries && entry.missingLibraries.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="shrink-0">
                  <Badge variant="warning" className="gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {t('addonManager.sceneryEntry.missingLibraries', {
                      count: entry.missingLibraries.length,
                    })}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3">
                <MissingLibraryLinks libraries={entry.missingLibraries} />
              </PopoverContent>
            </Popover>
          )}

          {/* Other packs that cover the same airports or tiles */}
          {entry.conflicts && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="shrink-0">
                  <Badge
                    variant={
                      entry.conflicts.duplicateAirports.some(
                        (dup) => dup.winner !== null && dup.winner !== entry.folderName
                      )
                        ? 'warning'
                        : 'secondary'
                    }
                    className="gap-1 text-xs"
                  >
                    <Layers className="h-3 w-3" />
                    {t('addonManager.scenery.conflicts.badge', {
                      count:
                        entry.conflicts.duplicateAirports.length +
                        entry.conflicts.duplicateTiles.length,
                    })}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-3">
                <SceneryConflictList folderName={entry.folderName} conflicts={entry.conflicts} />
              </PopoverContent>
            </Popover>
          )}

          {/* Open folder button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onOpenFolder(entry.fullPath)}
              >
                <FolderOpen className="text-muted-foreground h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{t('addonManager.sceneryEntry.openFolder')}</TooltipContent>
          </Tooltip>

          {/* Delete button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onDelete(entry.folderName)}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{t('addonManager.sceneryEntry.delete')}</TooltipContent>
          </Tooltip>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onToggle(entry.folderName)} disabled={disabled}>
          <Power className="mr-2 h-3.5 w-3.5" />
          {entry.enabled ? t('common.disable') : t('common.enable')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onOpenFolder(entry.fullPath)}>
          <FolderOpen className="mr-2 h-3.5 w-3.5" />
          {t('addonManager.sceneryEntry.openFolder')}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Tag className="mr-2 h-3.5 w-3.5" />
            {t('addonManager.scenery.category.set')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup
              value={String(priority)}
              onValueChange={(value) =>
                onSetCategory(entry.folderName, Number(value) as SceneryPriority)
              }
            >
              {CHOOSABLE_TIERS.map(([tier, label]) => (
                <ContextMenuRadioItem key={tier} value={String(tier)}>
                  {typeof label === 'string'
                    ? t(`addonManager.scenery.badge.${label}`)
                    : label.literal}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
            {overridden && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onSetCategory(entry.folderName, null)}>
                  {t('addonManager.scenery.category.reset')}
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onDelete(entry.folderName)}
          disabled={disabled}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {t('addonManager.sceneryEntry.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
