import type { LayerStatus } from '../layerInspector';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground/40 mt-1 mb-0.5 text-sm tracking-wider uppercase first:mt-0">
      {children}
    </div>
  );
}

export function Row({
  label,
  value,
  status,
  tip,
}: {
  label: string;
  value: string;
  status?: 'ok' | 'error' | 'off';
  tip?: string;
}) {
  const color =
    status === 'ok'
      ? 'text-success'
      : status === 'error'
        ? 'text-destructive'
        : status === 'off'
          ? 'text-warning'
          : 'text-foreground';

  return (
    <div className="flex justify-between gap-4 py-px" title={tip}>
      <span className="text-muted-foreground/70">{label}</span>
      <span className={`text-right ${color}`}>{value}</span>
    </div>
  );
}

export function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-px" title={value}>
      <span className="text-muted-foreground/70 shrink-0">{label}</span>
      <span className="text-foreground min-w-0 truncate">{value}</span>
    </div>
  );
}

export function Legend() {
  return (
    <div className="border-border/30 text-muted-foreground/40 mt-1.5 flex items-center gap-3 border-t pt-1.5 text-sm">
      <span className="flex items-center gap-1" title="Layer is rendering normally">
        <span className="bg-success inline-block h-1.5 w-1.5 rounded-full" />
        drawn
      </span>
      <span className="flex items-center gap-1" title="Hidden, out of zoom range, or loading">
        <span className="bg-warning inline-block h-1.5 w-1.5 rounded-full" />
        warn
      </span>
      <span className="flex items-center gap-1" title="Empty source or missing source">
        <span className="bg-destructive inline-block h-1.5 w-1.5 rounded-full" />
        error
      </span>
    </div>
  );
}

export function StatusDot({ status }: { status: LayerStatus }) {
  const color =
    status === 'drawn'
      ? 'bg-success'
      : status === 'hidden' || status === 'out-of-range' || status === 'loading'
        ? 'bg-warning'
        : 'bg-destructive';
  const pulse = status === 'loading' ? 'animate-pulse' : '';
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color} ${pulse}`} />;
}

export function OrderBadge({ order }: { order: number }) {
  return (
    <span
      className="bg-muted/50 text-foreground/50 inline-flex h-4 w-6 shrink-0 items-center justify-center rounded text-sm tabular-nums"
      title={`Draw order ${order} — lower = behind, higher = on top`}
    >
      {order}
    </span>
  );
}
