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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { DetectedItem } from '@/lib/addonManager/installer/types';
import { cn } from '@/lib/utils/helpers';

const TYPE_ICONS = {
  Aircraft: Plane,
  Scenery: Map,
  SceneryLibrary: Map,
  Plugin: Plug,
  LuaScript: FileCode,
  Livery: Paintbrush,
  Navdata: Database,
};

const TYPE_STYLES = {
  Aircraft: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    badge: 'bg-sky-500/20 text-sky-400',
  },
  Scenery: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/20 text-emerald-400',
  },
  SceneryLibrary: {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    badge: 'bg-teal-500/20 text-teal-400',
  },
  Plugin: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    badge: 'bg-violet-500/20 text-violet-400',
  },
  LuaScript: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
    badge: 'bg-orange-500/20 text-orange-400',
  },
  Livery: {
    bg: 'bg-pink-500/10',
    text: 'text-pink-400',
    border: 'border-pink-500/20',
    badge: 'bg-pink-500/20 text-pink-400',
  },
  Navdata: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    badge: 'bg-cyan-500/20 text-cyan-400',
  },
};

const DEFAULT_STYLE = {
  bg: 'bg-gray-500/10',
  text: 'text-gray-400',
  border: 'border-gray-500/20',
  badge: 'bg-gray-500/20 text-gray-400',
};

interface DetectedItemCardProps {
  item: DetectedItem;
}

export function DetectedItemCard({ item }: DetectedItemCardProps) {
  const { t } = useTranslation();
  const [warningsOpen, setWarningsOpen] = useState(false);
  const Icon = TYPE_ICONS[item.addonType] ?? HelpCircle;
  const style = TYPE_STYLES[item.addonType] ?? DEFAULT_STYLE;
  const hasWarnings = item.warnings.length > 0;

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
        'group rounded-lg border bg-card/50 transition-all hover:bg-card',
        hasWarnings ? 'border-warning/30' : 'border-border/50 hover:border-border'
      )}
    >
      <div className="flex items-center gap-3 p-3">
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
          <p className="truncate font-medium text-foreground" title={item.displayName}>
            {item.displayName}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', style.badge)}>
              {t(`addonManager.addonTypes.${item.addonType}`)}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatSize(item.estimatedSize)}
            </span>
          </div>
        </div>

        {/* Warning indicator */}
        {hasWarnings && (
          <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-warning transition-colors hover:bg-warning/10">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">{item.warnings.length}</span>
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', warningsOpen && 'rotate-180')}
              />
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {/* Warnings panel */}
      {hasWarnings && (
        <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
          <CollapsibleContent>
            <div className="border-t border-warning/20 bg-warning/5 px-3 py-2">
              {item.warnings.map((warning, idx) => (
                <p key={idx} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
