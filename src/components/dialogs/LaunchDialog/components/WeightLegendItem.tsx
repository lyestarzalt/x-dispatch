import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/helpers';

/**
 * One column of the loading gauge legend: coloured dot and label over the weight. The label
 * carries a short explanation on hover; the dotted underline says there is one.
 */
export function WeightLegendItem({
  dotClass,
  label,
  hint,
  value,
}: {
  dotClass: string;
  label: string;
  hint: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground flex min-w-0 items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="pointer-events-auto cursor-help truncate underline decoration-dotted underline-offset-2">
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-56">{hint}</TooltipContent>
        </Tooltip>
      </dt>
      <dd className="text-foreground truncate font-mono tabular-nums">{value}</dd>
    </div>
  );
}
