export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2 text-center">
      <p className="font-mono text-sm font-medium">{value}</p>
      <p className="text-muted-foreground text-2xs">{label}</p>
    </div>
  );
}
