// src/components/dialogs/AddonManager/components/AircraftEntry.tsx
import { FolderOpen, Lock, Plane, Trash2, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AircraftInfo } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';

interface AircraftEntryProps {
  aircraft: AircraftInfo;
  onToggle: (folderName: string) => void;
  onDelete: (folderName: string) => void;
  onLock: (folderName: string) => void;
  onOpenFolder: (folderName: string) => void;
  onOpenLiveries: (folderName: string) => void;
  disabled: boolean;
}

export function AircraftEntry({
  aircraft,
  onToggle,
  onDelete,
  onLock,
  onOpenFolder,
  onOpenLiveries,
  disabled,
}: AircraftEntryProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2',
        'transition-colors hover:bg-accent',
        !aircraft.enabled && 'bg-muted/30 opacity-60',
        aircraft.locked && 'border-warning/50'
      )}
    >
      {/* Icon */}
      <Plane className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Enable/disable toggle */}
      <Switch
        checked={aircraft.enabled}
        onCheckedChange={() => onToggle(aircraft.folderName)}
        disabled={disabled || aircraft.locked}
      />

      {/* Aircraft name */}
      <span className="flex-1 truncate font-mono text-sm">{aircraft.displayName}</span>

      {/* Version badge */}
      {aircraft.version && (
        <Badge variant={aircraft.hasUpdate ? 'destructive' : 'outline'} className="text-xs">
          v{aircraft.version}
          {aircraft.hasUpdate && aircraft.latestVersion && ` → ${aircraft.latestVersion}`}
        </Badge>
      )}

      {/* Liveries badge */}
      {aircraft.hasLiveries && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onOpenLiveries(aircraft.folderName)}
            >
              {aircraft.liveryCount} liveries
            </Button>
          </TooltipTrigger>
          <TooltipContent>View liveries</TooltipContent>
        </Tooltip>
      )}

      {/* Lock button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onLock(aircraft.folderName)}
            disabled={disabled}
          >
            {aircraft.locked ? (
              <Lock className="h-4 w-4 text-warning" />
            ) : (
              <Unlock className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{aircraft.locked ? 'Unlock' : 'Lock (prevent changes)'}</TooltipContent>
      </Tooltip>

      {/* Open folder button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenFolder(aircraft.folderName)}
          >
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open folder</TooltipContent>
      </Tooltip>

      {/* Delete button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(aircraft.folderName)}
            disabled={disabled || aircraft.locked}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete aircraft</TooltipContent>
      </Tooltip>
    </div>
  );
}
