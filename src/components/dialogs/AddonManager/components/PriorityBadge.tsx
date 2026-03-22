// src/components/dialogs/AddonManager/components/PriorityBadge.tsx
import type { BadgeProps } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { SceneryPriority } from '@/lib/addonManager/core/types';

const PRIORITY_CONFIG: Record<
  SceneryPriority,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  [SceneryPriority.FixedHighPriority]: { label: 'SAM', variant: 'warning' },
  [SceneryPriority.Airport]: { label: 'Airport', variant: 'success' },
  [SceneryPriority.DefaultAirport]: { label: 'Default', variant: 'info' },
  [SceneryPriority.Library]: { label: 'Library', variant: 'cat-sky' },
  [SceneryPriority.Other]: { label: 'Other', variant: 'secondary' },
  [SceneryPriority.Overlay]: { label: 'Overlay', variant: 'violet' },
  [SceneryPriority.AirportMesh]: { label: 'Mesh', variant: 'cat-amber' },
  [SceneryPriority.Mesh]: { label: 'Mesh', variant: 'secondary' },
  [SceneryPriority.Unrecognized]: { label: '???', variant: 'danger' },
};

interface PriorityBadgeProps {
  priority: SceneryPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <Badge variant={config.variant} className="min-w-[72px] justify-center">
      {config.label}
    </Badge>
  );
}
