// src/components/dialogs/AddonManager/components/AircraftCard.tsx
import { FolderOpen, Lock, MoreVertical, Plane, Trash2, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AircraftInfo } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';
import { useAircraftIcon } from '@/queries/useAddonManager';

interface AircraftCardProps {
  aircraft: AircraftInfo;
  onToggle: (folderName: string) => void;
  onDelete: (folderName: string) => void;
  onLock: (folderName: string) => void;
  onOpenFolder: (folderName: string) => void;
  onOpenLiveries: (folderName: string) => void;
  disabled: boolean;
}

export function AircraftCard({
  aircraft,
  onToggle,
  onDelete,
  onLock,
  onOpenFolder,
  onOpenLiveries,
  disabled,
}: AircraftCardProps) {
  const { data: iconSrc } = useAircraftIcon(aircraft.iconPath);

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-md',
        !aircraft.enabled && 'opacity-60',
        aircraft.locked && 'ring-1 ring-warning'
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'flex h-24 items-center justify-center bg-muted',
          !aircraft.enabled && 'grayscale'
        )}
      >
        {iconSrc ? (
          <img src={iconSrc} alt={aircraft.displayName} className="h-full w-full object-cover" />
        ) : (
          <Plane className="h-12 w-12 text-muted-foreground/50" />
        )}
      </div>

      <CardContent className="p-3">
        {/* Name */}
        <h3 className="truncate text-sm font-medium" title={aircraft.displayName}>
          {aircraft.displayName}
        </h3>

        {/* Badges row */}
        <div className="mt-1 flex flex-wrap gap-1">
          {aircraft.version && (
            <Badge variant={aircraft.hasUpdate ? 'destructive' : 'secondary'} className="text-xs">
              v{aircraft.version}
              {aircraft.hasUpdate && aircraft.latestVersion && ` → ${aircraft.latestVersion}`}
            </Badge>
          )}
          {aircraft.hasLiveries && (
            <Badge
              variant="outline"
              className="cursor-pointer text-xs hover:bg-accent"
              onClick={() => onOpenLiveries(aircraft.folderName)}
            >
              {aircraft.liveryCount} liveries
            </Badge>
          )}
        </div>

        {/* Actions row */}
        <div className="mt-3 flex items-center justify-between">
          <Switch
            checked={aircraft.enabled}
            onCheckedChange={() => onToggle(aircraft.folderName)}
            disabled={disabled || aircraft.locked}
          />

          <div className="flex items-center gap-1">
            {/* Lock */}
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
                    <Lock className="h-3.5 w-3.5 text-warning" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{aircraft.locked ? 'Unlock' : 'Lock'}</TooltipContent>
            </Tooltip>

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {aircraft.hasLiveries && (
                  <DropdownMenuItem onClick={() => onOpenLiveries(aircraft.folderName)}>
                    View {aircraft.liveryCount} liveries
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onOpenFolder(aircraft.folderName)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(aircraft.folderName)}
                  disabled={disabled || aircraft.locked}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
