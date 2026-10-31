// src/components/dialogs/AddonManager/components/DetectedItemCard.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  Database,
  FileCode,
  HelpCircle,
  Map,
  Paintbrush,
  Plane,
  Plug,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DetectedItem, InstallTask } from '@/lib/addonManager/installer/types';
import { cn } from '@/lib/utils/helpers';
import { MissingLibraryLinks } from './MissingLibraryLinks';

const TYPE_ICONS = {
  Aircraft: Plane,
  Scenery: Map,
  SceneryLibrary: Map,
  Plugin: Plug,
  LuaScript: FileCode,
  Livery: Paintbrush,
  Navdata: Database,
};

type BadgeVariant =
  | 'cat-sky'
  | 'cat-emerald'
  | 'cat-teal'
  | 'cat-amber'
  | 'cat-orange'
  | 'cat-pink'
  | 'default'
  | 'secondary';

const TYPE_STYLES: Record<
  string,
  { bg: string; text: string; border: string; badgeVariant: BadgeVariant }
> = {
  Aircraft: {
    bg: 'bg-cat-sky/10',
    text: 'text-cat-sky',
    border: 'border-cat-sky/20',
    badgeVariant: 'cat-sky',
  },
  Scenery: {
    bg: 'bg-cat-emerald/10',
    text: 'text-cat-emerald',
    border: 'border-cat-emerald/20',
    badgeVariant: 'cat-emerald',
  },
  SceneryLibrary: {
    bg: 'bg-cat-teal/10',
    text: 'text-cat-teal',
    border: 'border-cat-teal/20',
    badgeVariant: 'cat-teal',
  },
  Plugin: {
    bg: 'bg-cat-amber/10',
    text: 'text-cat-amber',
    border: 'border-cat-amber/20',
    badgeVariant: 'cat-amber',
  },
  LuaScript: {
    bg: 'bg-cat-orange/10',
    text: 'text-cat-orange',
    border: 'border-cat-orange/20',
    badgeVariant: 'cat-orange',
  },
  Livery: {
    bg: 'bg-cat-pink/10',
    text: 'text-cat-pink',
    border: 'border-cat-pink/20',
    badgeVariant: 'cat-pink',
  },
  Navdata: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    badgeVariant: 'default',
  },
};

const DEFAULT_STYLE = {
  bg: 'bg-muted-foreground/10',
  text: 'text-muted-foreground',
  border: 'border-muted-foreground/20',
  badgeVariant: 'secondary' as BadgeVariant,
};

type ConflictMode = 'overwrite' | 'clean';

interface DetectedItemCardProps {
  item: DetectedItem | InstallTask;
  /** When given, the card carries a checkbox and reports changes to it. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** When given and the add-on is already installed, the card offers overwrite or clean install. */
  onInstallModeChange?: (mode: ConflictMode) => void;
}

function isTask(item: DetectedItem | InstallTask): item is InstallTask {
  return 'conflictExists' in item;
}

export function DetectedItemCard({
  item,
  selected,
  onSelectedChange,
  onInstallModeChange,
}: DetectedItemCardProps) {
  const { t } = useTranslation();
  const [warningsOpen, setWarningsOpen] = useState(false);
  const Icon = TYPE_ICONS[item.addonType] ?? HelpCircle;
  const style = TYPE_STYLES[item.addonType] ?? DEFAULT_STYLE;
  const hasWarnings = item.warnings.length > 0;
  const task = isTask(item) ? item : null;
  const conflict = task !== null && task.conflictExists && onInstallModeChange !== undefined;
  const selectable = onSelectedChange !== undefined;
  const dimmed = selectable && selected === false;

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div
      className={cn(
        'group bg-card/50 hover:bg-card rounded-lg border transition-all',
        hasWarnings ? 'border-warning/30' : 'border-border/50 hover:border-border',
        dimmed && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
            aria-label={item.displayName}
          />
        )}

        {/* Icon */}
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors',
            style.bg,
            style.text
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate font-medium" title={item.displayName}>
            {item.displayName}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={style.badgeVariant} className="text-xs">
              {t(`addonManager.addonTypes.${item.addonType}`)}
            </Badge>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatSize(item.estimatedSize)}
            </span>
            {item.versionInfo && (
              <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
                {t('addonManager.installer.version', { version: item.versionInfo.version })}
              </span>
            )}
            {item.liveryInfo && (
              <span className="text-muted-foreground min-w-0 truncate text-xs">
                {t('addonManager.installer.forAircraft', {
                  aircraft: item.liveryInfo.aircraftName,
                })}
              </span>
            )}
          </div>
        </div>

        {/* Warning indicator */}
        {hasWarnings && (
          <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
            <CollapsibleTrigger className="text-warning hover:bg-warning/10 flex items-center gap-1 rounded-md px-2 py-1 transition-colors">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">{item.warnings.length}</span>
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', warningsOpen && 'rotate-180')}
              />
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {/* Already installed: what is there, and how to replace it */}
      {conflict && task && (
        <div className="border-border/50 flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-medium">
              {t('addonManager.installer.review.alreadyInstalled')}
            </span>
            {task.existingVersion && (
              <span className="text-muted-foreground truncate font-mono text-xs">
                {t('addonManager.installer.review.installedVersion', {
                  version: task.existingVersion,
                })}
              </span>
            )}
            {task.existingVersion && task.versionInfo && (
              <span className="text-muted-foreground truncate font-mono text-xs">
                {t('addonManager.installer.review.newVersion', {
                  version: task.versionInfo.version,
                })}
              </span>
            )}
            {task.existingNavdata?.cycle && (
              <span className="text-muted-foreground truncate font-mono text-xs">
                {t('addonManager.installer.review.installedCycle', {
                  cycle: task.existingNavdata.cycle,
                })}
              </span>
            )}
            {task.existingNavdata && task.navdataInfo?.cycle && (
              <span className="text-muted-foreground truncate font-mono text-xs">
                {t('addonManager.installer.review.newCycle', { cycle: task.navdataInfo.cycle })}
              </span>
            )}
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={task.installMode === 'clean' ? 'clean' : 'overwrite'}
            onValueChange={(value) => {
              if (value === 'overwrite' || value === 'clean') onInstallModeChange?.(value);
            }}
            className="shrink-0"
          >
            <ToggleGroupItem value="overwrite" className="text-xs">
              {t('addonManager.installer.review.overwrite')}
            </ToggleGroupItem>
            <ToggleGroupItem value="clean" className="text-xs">
              {t('addonManager.installer.review.clean')}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-muted-foreground w-full text-xs">
            {task.installMode === 'clean'
              ? t('addonManager.installer.review.cleanHint')
              : t('addonManager.installer.review.overwriteHint')}
          </p>
        </div>
      )}

      {/* Warnings panel */}
      {hasWarnings && (
        <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
          <CollapsibleContent>
            <div className="border-warning/20 bg-warning/5 border-t px-3 py-2">
              {item.warnings.map((warning, idx) => (
                <div key={idx}>
                  <p className="text-warning flex items-start gap-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="min-w-0">
                      {t(`addonManager.installer.warnings.${warning.code}`, warning.params)}
                    </span>
                  </p>
                  {warning.code === 'MISSING_LIBRARIES' && (
                    <div className="mt-2 pl-5">
                      <MissingLibraryLinks
                        libraries={String(warning.params?.libraries ?? '')
                          .split(', ')
                          .filter(Boolean)}
                        compact
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
