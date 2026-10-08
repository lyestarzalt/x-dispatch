import { cn } from '@/lib/utils/helpers';

/** One column of the loading gauge legend: coloured dot and label over the weight. */
export function WeightLegendItem({
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground flex min-w-0 items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-foreground truncate font-mono tabular-nums">{value}</dd>
    </div>
  );
}
