import { type ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="xp-section-heading">{title}</h3>
      {children}
    </section>
  );
}
