import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

export function EndpointLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="xp-label flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}
