export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground truncate text-xs">{label}</span>
      <span className="xp-value truncate font-semibold tabular-nums">{value}</span>
    </div>
  );
}
