import { Wind } from 'lucide-react';

export function MetarItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-2 text-center">
      <Icon className="text-muted-foreground mx-auto mb-1 h-4 w-4" />
      <p className="font-mono text-xs font-medium">{value}</p>
      <p className="text-muted-foreground text-2xs">{label}</p>
    </div>
  );
}
