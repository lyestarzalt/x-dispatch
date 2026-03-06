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
    bg: 'bg-cat-sky/10',
    text: 'text-cat-sky',
    border: 'border-cat-sky/20',
    badge: 'bg-cat-sky/20 text-cat-sky',
  },
  Scenery: {
    bg: 'bg-cat-emerald/10',
    text: 'text-cat-emerald',
    border: 'border-cat-emerald/20',
    badge: 'bg-cat-emerald/20 text-cat-emerald',
  },
  SceneryLibrary: {
    bg: 'bg-cat-teal/10',
    text: 'text-cat-teal',
    border: 'border-cat-teal/20',
    badge: 'bg-cat-teal/20 text-cat-teal',
  },
  Plugin: {
    bg: 'bg-violet/10',
    text: 'text-violet',
    border: 'border-violet/20',
    badge: 'bg-violet/20 text-violet',
  },
  LuaScript: {
    bg: 'bg-cat-orange/10',
    text: 'text-cat-orange',
    border: 'border-cat-orange/20',
    badge: 'bg-cat-orange/20 text-cat-orange',
  },
  Livery: {
    bg: 'bg-cat-pink/10',
    text: 'text-cat-pink',
    border: 'border-cat-pink/20',
    badge: 'bg-cat-pink/20 text-cat-pink',
  },
  Navdata: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    badge: 'bg-primary/20 text-primary',
  },
};

const DEFAULT_STYLE = {
  bg: 'bg-muted-foreground/10',
  text: 'text-muted-foreground',
  border: 'border-muted-foreground/20',
  badge: 'bg-muted-foreground/20 text-muted-foreground',
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
