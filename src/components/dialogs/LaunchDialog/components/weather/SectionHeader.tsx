// ─── Section Header ─────────────────────────────────────────────────────────

export function SectionHeader({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {text}
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}
