import { useTranslation } from 'react-i18next';
import { Milestone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFlightPlanStore } from '@/stores/flightPlanStore';

/**
 * Shows or hides the strip of the plan's fixes along the top of the map. It sits with the plan's
 * own panel (the planner, the SimBrief panel), next to the profile toggle where there is one, so
 * the strip can be put away and brought back, also after its X cleared the plan from the map.
 */
export function StripToggle({
  className,
  onDraw,
}: {
  className?: string;
  /** Draws the panel's plan when it is not on the map (cleared from the strip's X). */
  onDraw?: () => void;
}) {
  const { t } = useTranslation();
  const onMap = useFlightPlanStore((s) => s.fmsData !== null);
  const shown = useFlightPlanStore((s) => s.showFlightPlanBar);
  const setShown = useFlightPlanStore((s) => s.setFlightPlanBarShown);
  const label = shown && onMap ? t('flightPlanBar.hide') : t('flightPlanBar.show');
  return (
    <Button
      variant={shown && onMap ? 'secondary' : 'ghost'}
      size="icon-xs"
      className={className}
      onClick={() => {
        if (onMap) setShown(!shown);
        else onDraw?.();
      }}
      disabled={!onMap && !onDraw}
      aria-pressed={shown && onMap}
      aria-label={label}
      tooltip={label}
    >
      <Milestone className="h-3.5 w-3.5" />
    </Button>
  );
}
