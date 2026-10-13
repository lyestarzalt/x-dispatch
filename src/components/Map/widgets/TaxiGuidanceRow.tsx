import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowUpToLine,
  CircleCheck,
  CornerUpLeft,
  CornerUpRight,
  type LucideIcon,
  OctagonMinus,
  SquareParking,
  TriangleAlert,
} from 'lucide-react';
import { useTaxiGuidance } from '@/hooks/useTaxiGuidance';
import { useUnits } from '@/hooks/useUnits';
import type { GuidanceEvent, TurnKind } from '@/lib/taxiGuidance';
import { metersToFeet } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import { usePlaneStore } from '@/stores/planeStore';

const TURN_ICON: Record<TurnKind, LucideIcon> = {
  continue: ArrowUp,
  bearLeft: ArrowUpLeft,
  bearRight: ArrowUpRight,
  turnLeft: CornerUpLeft,
  turnRight: CornerUpRight,
  sharpLeft: ArrowDownLeft,
  sharpRight: ArrowDownRight,
};

/** What the row says: the next event, or the pilot having left the route or reached its end. */
type RowStatus = GuidanceEvent | { kind: 'offRoute' } | { kind: 'arrived' };

function StatusIcon({ status, className }: { status: RowStatus; className: string }) {
  switch (status.kind) {
    case 'turn': {
      const TurnIcon = TURN_ICON[status.turn];
      return <TurnIcon className={className} />;
    }
    case 'cross':
      return <ArrowUpToLine className={className} />;
    case 'holdShort':
      return <OctagonMinus className={className} />;
    case 'arrive':
      return <SquareParking className={className} />;
    case 'offRoute':
      return <TriangleAlert className={className} />;
    case 'arrived':
      return <CircleCheck className={className} />;
  }
}

function statusColor(status: RowStatus): string {
  switch (status.kind) {
    case 'offRoute':
      return 'text-warning';
    case 'arrived':
      return 'text-success';
    case 'holdShort':
      return 'text-destructive';
    case 'cross':
      return 'text-warning';
    case 'arrive':
      return 'text-success';
    default:
      return 'text-primary';
  }
}

/** Distance to the next instruction, or NOW / HOLD once the aircraft is there. */
function distanceText(
  next: { event: GuidanceEvent; distance: number; now: boolean },
  t: TFunction,
  format: (m: number) => string
): string | null {
  if (next.now)
    return next.event.kind === 'holdShort' ? t('taxiGuidance.hold') : t('taxiGuidance.now');
  return next.distance > 0 ? format(next.distance) : null;
}

function statusLabel(event: RowStatus, t: TFunction): string {
  switch (event.kind) {
    case 'offRoute':
      return t('taxiGuidance.offRoute');
    case 'arrived':
      return t('taxiGuidance.arrived');
    case 'turn':
      return event.name
        ? t(`taxiGuidance.${event.turn}Onto`, { name: event.name })
        : t(`taxiGuidance.${event.turn}`);
    case 'cross':
      return t('taxiGuidance.crossRunway', { runway: event.runway });
    case 'holdShort':
      return event.runway
        ? t('taxiGuidance.holdShortRunway', { runway: event.runway })
        : t('taxiGuidance.holdShort');
    case 'arrive':
      return event.name
        ? t('taxiGuidance.arriveStand', { name: event.name })
        : t('taxiGuidance.arrive');
  }
}

/**
 * Turn-by-turn taxi guidance under the flight strip, shown while the aircraft is
 * on the ground on a planned route. Sized to the strip (`w-0 min-w-full`), never
 * widening it: long translations truncate.
 */
export default function TaxiGuidanceRow() {
  const { t } = useTranslation();
  const units = useUnits();
  const guidance = useTaxiGuidance();
  const heading = usePlaneStore((s) => s.state?.heading);
  if (!guidance) return null;
  const { offRoute, arrived, next, then } = guidance.view;
  if (!offRoute && !arrived && !next) return null;

  const status: RowStatus = offRoute
    ? { kind: 'offRoute' }
    : arrived || !next
      ? { kind: 'arrived' }
      : next.event;
  const color = statusColor(status);
  const bearing = guidance.bearing;
  const auto = guidance.route.source === 'auto';
  const distance =
    !offRoute && next ? distanceText(next, t, (m) => units.shortDistance(metersToFeet(m))) : null;

  return (
    <div className="border-border/50 flex w-0 min-w-full items-center gap-2 border-t px-3 py-1.5">
      <span
        className="border-border text-muted-foreground shrink-0 rounded-sm border px-1 font-mono text-[10px] uppercase"
        title={auto ? t('taxiGuidance.sourceAutoHint') : t('taxiGuidance.sourcePlannedHint')}
      >
        {auto ? t('taxiGuidance.sourceAuto') : t('taxiGuidance.sourcePlanned')}
      </span>
      {guidance.taxiway && (
        <span className="shrink-0 font-mono text-sm uppercase">
          <span className="text-muted-foreground">{t('taxiGuidance.on')} </span>
          <span className="text-cat-amber font-semibold">{guidance.taxiway}</span>
        </span>
      )}
      <StatusIcon status={status} className={cn('h-4 w-4 shrink-0', color)} />
      {distance && <span className="xp-value shrink-0">{distance}</span>}
      <span className={cn('min-w-0 truncate font-mono text-sm font-semibold uppercase', color)}>
        {statusLabel(status, t)}
      </span>
      {!offRoute && then && (
        <span className="text-muted-foreground min-w-0 truncate text-xs uppercase">
          {t('taxiGuidance.then', { instruction: statusLabel(then, t) })}
        </span>
      )}
      {bearing !== null && heading !== undefined && (
        <ArrowUp
          role="img"
          aria-label={t('taxiGuidance.direction')}
          className={cn('ml-auto h-4 w-4 shrink-0', color)}
          style={{ transform: `rotate(${bearing - heading}deg)` }}
        />
      )}
    </div>
  );
}
