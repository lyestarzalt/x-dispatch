export function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="xp-label">{label}</span>
      <span className="xp-value tabular-nums">{value}</span>
    </div>
  );
}
