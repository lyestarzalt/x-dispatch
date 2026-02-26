// src/components/dialogs/AddonManager/components/SceneryEntry.tsx
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FolderOpen, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SceneryEntry } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';
import { PriorityBadge } from './PriorityBadge';

interface SortableSceneryEntryProps {
  entry: SceneryEntry;
  onToggle: (folderName: string) => void;
  onOpenFolder: (fullPath: string) => void;
  disabled: boolean;
}

export function SortableSceneryEntry({
  entry,
  onToggle,
  onOpenFolder,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2',
        'transition-colors hover:bg-accent',
        !entry.enabled && 'bg-muted/30 opacity-60',
        isDragging && 'z-50 border-primary shadow-lg'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab touch-none rounded p-1 hover:bg-muted',
          isDragging && 'cursor-grabbing'
        )}
        disabled={disabled}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Enable/disable toggle */}
      <Switch
        checked={entry.enabled}
        onCheckedChange={() => onToggle(entry.folderName)}
        disabled={disabled}
      />

      {/* Priority badge */}
      <PriorityBadge priority={entry.priority} />

      {/* Folder name */}
      <span className="flex-1 truncate font-mono text-sm">{entry.folderName}</span>

      {/* Open folder button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenFolder(entry.fullPath)}
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('addonManager.sceneryEntry.openFolder')}</TooltipContent>
      </Tooltip>
    </div>
  );
}
