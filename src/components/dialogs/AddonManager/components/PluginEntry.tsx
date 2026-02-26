// src/components/dialogs/AddonManager/components/PluginEntry.tsx
import { Code, FolderOpen, Lock, Plug, Trash2, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PluginInfo } from '@/lib/addonManager/core/types';
import { cn } from '@/lib/utils/helpers';

const PLATFORM_LABELS: Record<PluginInfo['platform'], string> = {
  win: 'Win',
  mac: 'Mac',
  lin: 'Linux',
  multi: 'Multi',
  unknown: '?',
};

interface PluginEntryProps {
  plugin: PluginInfo;
  onToggle: (folderName: string) => void;
  onDelete: (folderName: string) => void;
  onLock: (folderName: string) => void;
  onOpenFolder: (folderName: string) => void;
  onOpenScripts?: () => void;
  disabled: boolean;
}

export function PluginEntry({
  plugin,
  onToggle,
  onDelete,
  onLock,
  onOpenFolder,
  onOpenScripts,
  disabled,
}: PluginEntryProps) {
  const isFlyWithLua = plugin.folderName.toLowerCase() === 'flywithlua';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2',
        'transition-colors hover:bg-accent',
        !plugin.enabled && 'bg-muted/30 opacity-60',
        plugin.locked && 'border-warning/50'
      )}
    >
      {/* Icon */}
      <Plug className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Enable/disable toggle */}
      <Switch
        checked={plugin.enabled}
        onCheckedChange={() => onToggle(plugin.folderName)}
        disabled={disabled || plugin.locked}
      />

      {/* Plugin name */}
      <span className="flex-1 truncate font-mono text-sm">{plugin.displayName}</span>

      {/* Platform badge */}
      <Badge variant="outline" className="text-xs">
        {PLATFORM_LABELS[plugin.platform]}
      </Badge>

      {/* Version badge */}
      {plugin.version && (
        <Badge variant={plugin.hasUpdate ? 'destructive' : 'secondary'} className="text-xs">
          v{plugin.version}
          {plugin.hasUpdate && plugin.latestVersion && ` → ${plugin.latestVersion}`}
        </Badge>
      )}

      {/* Scripts button (FlyWithLua only) */}
      {isFlyWithLua && plugin.hasScripts && onOpenScripts && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={onOpenScripts}
            >
              <Code className="h-3.5 w-3.5" />
              {plugin.scriptCount} scripts
            </Button>
          </TooltipTrigger>
          <TooltipContent>Manage Lua scripts</TooltipContent>
        </Tooltip>
      )}

      {/* Lock button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onLock(plugin.folderName)}
            disabled={disabled}
          >
            {plugin.locked ? (
              <Lock className="h-4 w-4 text-warning" />
            ) : (
              <Unlock className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{plugin.locked ? 'Unlock' : 'Lock (prevent changes)'}</TooltipContent>
      </Tooltip>

      {/* Open folder button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenFolder(plugin.folderName)}
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
            onClick={() => onDelete(plugin.folderName)}
            disabled={disabled || plugin.locked}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete plugin</TooltipContent>
      </Tooltip>
    </div>
  );
}
