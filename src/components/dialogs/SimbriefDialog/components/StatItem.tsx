import { Timer } from 'lucide-react';

export function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-muted-foreground h-4 w-4" />
      <div>
        <p className="text-muted-foreground text-2xs tracking-wider uppercase">{label}</p>
        <p className="text-foreground font-mono text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
