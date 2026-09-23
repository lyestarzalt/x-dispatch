// src/components/dialogs/AddonManager/components/SceneryEntry.tsx
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FolderOpen, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SceneryEntry } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';
import { PriorityBadge } from './PriorityBadge';

interface SortableSceneryEntryProps {
  entry: SceneryEntry;
  position: number;
  totalCount: number;
  onToggle: (folderName: string) => void;
  onOpenFolder: (fullPath: string) => void;
  onDelete: (folderName: string) => void;
  disabled: boolean;
}

export function SortableSceneryEntry({
  entry,
  position,
  totalCount,
  onToggle,
  onOpenFolder,
  onDelete,
  disabled,
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
        size="icon"
        {...attributes}
        {...listeners}
        className={cn(
          'h-7 w-7 cursor-grab',
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
      <PriorityBadge priority={entry.priority} />

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

      {/* Open folder button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
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
            size="icon"
            className="hover:text-destructive h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onDelete(entry.folderName)}
            disabled={disabled}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{t('addonManager.sceneryEntry.delete')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
