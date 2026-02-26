// src/components/dialogs/AddonManager/components/DetectedItemCard.tsx
import { AlertTriangle, Database, FileCode, Map, Paintbrush, Plane, Puzzle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { DetectedItem } from '@/lib/addonManager/installer/types';

const TYPE_ICONS = {
  Aircraft: Plane,
  Scenery: Map,
  SceneryLibrary: Map,
  Plugin: Puzzle,
  LuaScript: FileCode,
  Livery: Paintbrush,
  Navdata: Database,
};

const TYPE_COLORS = {
  Aircraft: 'bg-blue-500/10 text-blue-500',
  Scenery: 'bg-green-500/10 text-green-500',
  SceneryLibrary: 'bg-emerald-500/10 text-emerald-500',
  Plugin: 'bg-purple-500/10 text-purple-500',
  LuaScript: 'bg-orange-500/10 text-orange-500',
  Livery: 'bg-pink-500/10 text-pink-500',
  Navdata: 'bg-cyan-500/10 text-cyan-500',
};

interface DetectedItemCardProps {
  item: DetectedItem;
}

export function DetectedItemCard({ item }: DetectedItemCardProps) {
  const Icon = TYPE_ICONS[item.addonType];
  const colorClass = TYPE_COLORS[item.addonType];

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
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.displayName}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {item.addonType}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatSize(item.estimatedSize)}</span>
          </div>
        </div>
        {item.warnings.length > 0 && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
      </CardContent>
    </Card>
  );
}
