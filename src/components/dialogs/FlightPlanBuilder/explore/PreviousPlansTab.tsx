import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IcaoCode } from '@/components/ui/icao-code';
import { formatLevel } from '@/lib/flightplan/builder/formatLevel';
import { type PreviousPlan, usePlanBuilderStore } from '@/stores/planBuilderStore';
import { timeAgo } from './timeAgo';

/** What sets the plan apart at a glance: its procedures, its cruise level, then its route. */
function planDetail(plan: PreviousPlan): string {
  const procedures = [
    plan.departure?.sid?.name,
    plan.arrival?.star?.name,
    plan.arrival?.approach?.name,
  ].filter(Boolean);
  const cruise = plan.cruiseAltitudeFt !== null ? formatLevel(plan.cruiseAltitudeFt) : null;
  return [...procedures, cruise, plan.routeText.trim()].filter(Boolean).join('  ');
}

/**
 * The last plans the planner put away: cleared from the strip, replaced by a new plan, a swap or
 * another airport. Each is kept whole, the typed route included, and loads back with a click.
 */
export function PreviousPlansTab() {
  const { t, i18n } = useTranslation();
  const plans = usePlanBuilderStore((s) => s.previousPlans);
  const restore = usePlanBuilderStore((s) => s.restorePreviousPlan);
  const remove = usePlanBuilderStore((s) => s.removePreviousPlan);
  // The moment the list was opened: ages are read once, not on every render.
  const [openedAt] = useState(() => Date.now());

  if (plans.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-xs">{t('explore.previous.none')}</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {plans.map((plan) => (
        <div
          key={plan.savedAt}
          className="group hover:bg-muted/50 flex min-w-0 items-center gap-1 rounded transition-colors"
        >
          <button
            onClick={() => restore(plan.savedAt)}
            className="min-w-0 flex-1 px-2 py-1.5 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <IcaoCode className="shrink-0 text-sm">{plan.departure?.icao}</IcaoCode>
              <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <IcaoCode className="shrink-0 text-sm">{plan.arrival?.icao}</IcaoCode>
              <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-xs tabular-nums">
                {timeAgo(plan.savedAt, openedAt, i18n.language)}
              </span>
            </span>
            <span className="text-muted-foreground block truncate font-mono text-xs uppercase">
              {planDetail(plan)}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground mr-1 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => remove(plan.savedAt)}
            aria-label={t('explore.previous.remove')}
            tooltip={t('explore.previous.remove')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
