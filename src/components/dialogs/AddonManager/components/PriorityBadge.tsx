// src/components/dialogs/AddonManager/components/PriorityBadge.tsx
import { Badge } from '@/components/ui/badge';
import { SceneryPriority } from '@/lib/addonManager/core/types';

const PRIORITY_CONFIG: Record<
  SceneryPriority,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  [SceneryPriority.FixedHighPriority]: { label: 'SAM', variant: 'default' },
  [SceneryPriority.Airport]: { label: 'Airport', variant: 'default' },
  [SceneryPriority.DefaultAirport]: { label: 'Default', variant: 'secondary' },
  [SceneryPriority.Library]: { label: 'Library', variant: 'outline' },
  [SceneryPriority.Other]: { label: 'Other', variant: 'secondary' },
  [SceneryPriority.Overlay]: { label: 'Overlay', variant: 'outline' },
  [SceneryPriority.AirportMesh]: { label: 'AirportMesh', variant: 'secondary' },
  [SceneryPriority.Mesh]: { label: 'Mesh', variant: 'secondary' },
  [SceneryPriority.Unrecognized]: { label: '???', variant: 'destructive' },
};

interface PriorityBadgeProps {
  priority: SceneryPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge variant={config.variant} className="min-w-[80px] justify-center text-xs">
      {config.label}
    </Badge>
  );
}
