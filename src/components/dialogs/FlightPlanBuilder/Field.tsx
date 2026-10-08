import { type ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <span className="xp-label block truncate">{label}</span>
      {children}
    </div>
  );
}
