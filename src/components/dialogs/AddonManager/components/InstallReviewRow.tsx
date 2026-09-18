// src/components/dialogs/AddonManager/components/InstallReviewRow.tsx
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode,
  Map,
  Paintbrush,
  Plane,
  Plug,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AddonType, InstallResult, InstallTask } from '@/lib/addonManager/installer/types';
import { cn } from '@/lib/utils/helpers';

const TYPE_ICONS: Record<AddonType, typeof Plane> = {
  Aircraft: Plane,
  Scenery: Map,
  SceneryLibrary: Map,
  Plugin: Plug,
  LuaScript: FileCode,
  Livery: Paintbrush,
  Navdata: Database,
};

export type InstallMode = 'overwrite' | 'clean';
export type RowStatus = 'pending' | 'running' | 'done';

interface InstallReviewRowProps {
  task: InstallTask;
  selected: boolean;
  mode: InstallMode;
  status: RowStatus;
  result?: InstallResult;
  disabled: boolean;
  onSelectedChange: (selected: boolean) => void;
  onModeChange: (mode: InstallMode) => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function StatusIcon({ status, result }: { status: RowStatus; result?: InstallResult }) {
  if (status === 'running') return <Spinner className="size-4 text-primary" />;
  if (status !== 'done' || !result) return null;
  if (result.skipped) return <SkipForward className="h-4 w-4 text-muted-foreground" />;
  return result.success ? (
    <CheckCircle2 className="h-4 w-4 text-success" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  );
}

export function InstallReviewRow({
  task,
  selected,
  mode,
  status,
  result,
  disabled,
  onSelectedChange,
  onModeChange,
}: InstallReviewRowProps) {
  const { t } = useTranslation();
  const Icon = TYPE_ICONS[task.addonType];
  const showControls = status === 'pending';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3',
        !selected && showControls && 'opacity-50',
        status === 'running' && 'border-primary/40'
      )}
    >
      <div className="flex items-start gap-3">
        {showControls ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(value) => onSelectedChange(value === true)}
            disabled={disabled}
            className="mt-0.5"
          />
        ) : (
          <div className="mt-0.5 flex h-4 w-4 items-center justify-center">
            <StatusIcon status={status} result={result} />
          </div>
        )}

        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{task.displayName}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {t(`addonManager.addonTypes.${task.addonType}`)}
            </Badge>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatSize(task.estimatedSize)}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {t('addonManager.installer.target', { path: task.targetPath })}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom">{task.targetPath}</TooltipContent>
          </Tooltip>

          {task.warnings.map((warning) => (
            <p key={warning} className="mt-1 flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {warning}
            </p>
          ))}

          {result?.error && <p className="mt-1 text-xs text-destructive">{result.error}</p>}
          {result?.skipped && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('addonManager.installer.skipped')}
            </p>
          )}
          {result?.backupPath && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {t('addonManager.installer.backupSaved')}
            </p>
          )}
        </div>
      </div>

      {showControls && task.conflictExists && (
        <div className="flex items-center gap-3 pl-10">
          <span className="text-xs text-warning">
            {t('addonManager.installer.alreadyInstalled')}
          </span>
          <ToggleGroup
            type="single"
            size="sm"
            value={mode}
            onValueChange={(value) => value && onModeChange(value as InstallMode)}
            disabled={disabled || !selected}
          >
            <ToggleGroupItem value="overwrite" className="h-6 px-2 text-xs">
              {t('addonManager.installer.modeMerge')}
            </ToggleGroupItem>
            <ToggleGroupItem value="clean" className="h-6 px-2 text-xs">
              {t('addonManager.installer.modeClean')}
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="truncate text-xs text-muted-foreground">
            {t(
              mode === 'clean'
                ? 'addonManager.installer.modeCleanHint'
                : 'addonManager.installer.modeMergeHint'
            )}
          </span>
        </div>
      )}
    </div>
  );
}
