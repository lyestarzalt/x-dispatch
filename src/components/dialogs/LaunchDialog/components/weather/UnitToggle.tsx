import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// ─── Unit Toggle ────────────────────────────────────────────────────────────

export function UnitToggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string];
  onChange: (v: string) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="subtle"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      className="gap-1"
    >
      {options.map((opt) => (
        <ToggleGroupItem key={opt} value={opt} className="h-6 px-2 text-xs">
          {opt}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
