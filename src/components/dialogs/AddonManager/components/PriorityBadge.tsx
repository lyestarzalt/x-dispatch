// src/components/dialogs/AddonManager/components/PriorityBadge.tsx
import { useTranslation } from 'react-i18next';
import type { BadgeProps } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { SceneryPriority } from '@/lib/addonManager/core/types';

type BadgeKey = 'airports' | 'defaultAirports' | 'libraries' | 'other' | 'overlays' | 'mesh';

/** `label` is a key under `addonManager.scenery.badge`; SAM is a plugin name and `???` a symbol. */
const PRIORITY_CONFIG: Record<
  SceneryPriority,
  { label: BadgeKey | { literal: string }; variant: NonNullable<BadgeProps['variant']> }
> = {
  [SceneryPriority.FixedHighPriority]: { label: { literal: 'SAM' }, variant: 'warning' },
  [SceneryPriority.Airport]: { label: 'airports', variant: 'success' },
  [SceneryPriority.DefaultAirport]: { label: 'defaultAirports', variant: 'info' },
  [SceneryPriority.Library]: { label: 'libraries', variant: 'cat-sky' },
  [SceneryPriority.Other]: { label: 'other', variant: 'secondary' },
  [SceneryPriority.Overlay]: { label: 'overlays', variant: 'violet' },
  [SceneryPriority.AirportMesh]: { label: 'mesh', variant: 'cat-amber' },
  [SceneryPriority.Mesh]: { label: 'mesh', variant: 'secondary' },
  [SceneryPriority.Unrecognized]: { label: { literal: '???' }, variant: 'danger' },
};

interface PriorityBadgeProps {
  priority: SceneryPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { t } = useTranslation();
  const config = PRIORITY_CONFIG[priority];
  const label =
    typeof config.label === 'string'
      ? t(`addonManager.scenery.badge.${config.label}`)
      : config.label.literal;

  return (
    <Badge variant={config.variant} className="min-w-[72px] justify-center">
      {label}
    </Badge>
  );
}
