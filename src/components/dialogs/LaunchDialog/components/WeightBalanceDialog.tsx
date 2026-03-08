import { useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { AlertTriangle, Fuel, Users, X } from 'lucide-react';
import { Pie, PieChart, Label as PieLabel } from 'recharts';
import { Button } from '@/components/ui/button';
import { type ChartConfig, ChartContainer } from '@/components/ui/chart';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatWeight } from '@/lib/utils/format';
import type { WeightUnit } from '@/lib/utils/format';
import { cn } from '@/lib/utils/helpers';
import { useLaunchStore } from '@/stores/launchStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface WeightBalanceDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Chart Config (design system colors) ─────────────────────────────────────

const chartConfig = {
  weight: { label: 'Weight' },
  fuel: { label: 'Fuel', color: 'oklch(var(--primary))' },
  payload: { label: 'Payload', color: 'oklch(var(--success))' },
  payloadOver: { label: 'Payload', color: 'oklch(var(--destructive))' },
  remaining: { label: 'Remaining', color: 'oklch(var(--muted) / 0.3)' },
} satisfies ChartConfig;

// ─── Weight Donut ────────────────────────────────────────────────────────────

function WeightDonut({
  emptyWeight,
  payloadWeight,
  fuelWeight,
  maxWeight,
  weightUnit,
}: {
  emptyWeight: number;
  payloadWeight: number;
  fuelWeight: number;
  maxWeight: number;
  weightUnit: WeightUnit;
}) {
  const totalWeight = emptyWeight + payloadWeight + fuelWeight;
  const usefulLoad = maxWeight - emptyWeight; // max capacity for fuel + payload
  const isOverweight = totalWeight > maxWeight;
  const remaining = Math.max(0, maxWeight - totalWeight);

  // Donut shows only useful load breakdown (fuel + payload + remaining)
  // Empty weight is fixed and shown in text only — like X-Plane's W&B screen
  const chartData = useMemo(
    () => [
      { segment: 'fuel', weight: fuelWeight, fill: 'var(--color-fuel)' },
      {
        segment: isOverweight ? 'payloadOver' : 'payload',
        weight: payloadWeight,
        fill: isOverweight ? 'var(--color-payloadOver)' : 'var(--color-payload)',
      },
      { segment: 'remaining', weight: remaining, fill: 'var(--color-remaining)' },
    ],
    [fuelWeight, payloadWeight, remaining, isOverweight]
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square h-48 w-48">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="weight"
            nameKey="segment"
            innerRadius={56}
            outerRadius={80}
            strokeWidth={2}
            stroke="oklch(var(--background))"
            isAnimationActive={false}
          >
            <PieLabel
              content={({ viewBox }) => {
                if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) - 6}
                      className={cn(
                        'fill-foreground font-mono text-xl font-semibold',
                        isOverweight && 'fill-destructive'
                      )}
                    >
                      {formatWeight(fuelWeight + payloadWeight, weightUnit)}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 12}
                      className="fill-muted-foreground text-xs"
                    >
                      / {formatWeight(usefulLoad, weightUnit)}
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {isOverweight && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-sm font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />+
          {formatWeight(totalWeight - maxWeight, weightUnit)} over
        </div>
      )}

      {/* Weight breakdown */}
      <div className="w-full space-y-1.5 text-sm">
        <WeightRow
          dotClass="bg-muted-foreground/40"
          label="Empty"
          value={emptyWeight}
          unit={weightUnit}
        />
        <WeightRow dotClass="bg-primary" label="Fuel" value={fuelWeight} unit={weightUnit} />
        <WeightRow
          dotClass={isOverweight ? 'bg-destructive' : 'bg-success'}
          label="Payload"
          value={payloadWeight}
          unit={weightUnit}
        />
        <div className="border-t border-border pt-1.5">
          <div className="flex items-center justify-between font-medium">
            <span>Total</span>
            <span className={cn('font-mono', isOverweight && 'text-destructive')}>
              {formatWeight(totalWeight, weightUnit)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Max</span>
            <span className="font-mono">{formatWeight(maxWeight, weightUnit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightRow({
  dotClass,
  label,
  value,
  unit,
}: {
  dotClass: string;
  label: string;
  value: number;
  unit: WeightUnit;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5">
        <span className={cn('inline-block h-2 w-2 rounded-full', dotClass)} />
        {label}
      </span>
      <span className="font-mono">{formatWeight(value, unit)}</span>
    </div>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export function WeightBalanceDialog({ open, onClose }: WeightBalanceDialogProps) {
  const weightUnit = useSettingsStore((s) => s.map.units.weight);
  const mapSettings = useSettingsStore((s) => s.map);
  const updateMapSettings = useSettingsStore((s) => s.updateMapSettings);

  const selectedAircraft = useLaunchStore((s) => s.selectedAircraft);
  const tankPercentages = useLaunchStore((s) => s.tankPercentages);
  const payloadWeights = useLaunchStore((s) => s.payloadWeights);
  const setTankPercentage = useLaunchStore((s) => s.setTankPercentage);
  const setAllTanksPercentage = useLaunchStore((s) => s.setAllTanksPercentage);
  const setPayloadWeight = useLaunchStore((s) => s.setPayloadWeight);

  const payloadStations = selectedAircraft?.payloadStations ?? [];
  const tankNames = selectedAircraft?.tankNames ?? [];

  const { totalFuelLbs, totalPayloadLbs, tankCapacities } = useMemo(() => {
    if (!selectedAircraft) return { totalFuelLbs: 0, totalPayloadLbs: 0, tankCapacities: [] };

    const ratios = selectedAircraft.tankRatios ?? [];
    const caps = ratios.map((r) => r * selectedAircraft.maxFuel);
    const fuel = caps.reduce((sum, cap, i) => sum + (cap * (tankPercentages[i] ?? 0)) / 100, 0);
    const payload = (payloadWeights ?? []).reduce((sum, w) => sum + w, 0);

    return { totalFuelLbs: fuel, totalPayloadLbs: payload, tankCapacities: caps };
  }, [selectedAircraft, tankPercentages, payloadWeights]);

  const overallFuelPct = useMemo(() => {
    if (!tankPercentages || tankPercentages.length === 0) return 0;
    return Math.round(tankPercentages.reduce((s, p) => s + p, 0) / tankPercentages.length);
  }, [tankPercentages]);

  if (!selectedAircraft) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100vh-3rem)] w-[720px] max-w-[calc(100vw-3rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Weight &amp; Fuel</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header */}
          <div className="flex h-11 items-center justify-between border-b border-border bg-card px-4">
            <span className="text-sm font-medium">Weight &amp; Fuel</span>
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={weightUnit}
                onValueChange={(value) => {
                  if (value)
                    updateMapSettings({
                      units: { ...mapSettings.units, weight: value as WeightUnit },
                    });
                }}
                size="sm"
                className="gap-0 rounded-md border border-border"
              >
                <ToggleGroupItem value="kg" className="h-7 rounded-r-none px-2.5 text-xs">
                  kg
                </ToggleGroupItem>
                <ToggleGroupItem value="lbs" className="h-7 rounded-l-none px-2.5 text-xs">
                  lbs
                </ToggleGroupItem>
              </ToggleGroup>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex min-h-0 gap-0">
            {/* Left: Sliders */}
            <div
              className="min-w-0 flex-1 space-y-5 overflow-y-auto border-r border-border p-5"
              style={{ maxHeight: '65vh' }}
            >
              {/* Payload Section */}
              {payloadStations.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-success" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Payload
                    </span>
                  </div>
                  <div className="space-y-3">
                    {payloadStations.map((station, i) => (
                      <SliderRow
                        key={i}
                        label={station.name}
                        value={payloadWeights[i] ?? 0}
                        max={station.maxWeight}
                        step={Math.max(1, Math.round(station.maxWeight / 100))}
                        onChange={(v) => setPayloadWeight(i, v)}
                        formatValue={(v) => formatWeight(v, weightUnit)}
                        formatMax={(v) => formatWeight(v, weightUnit)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Fuel Section */}
              <section>
                <div className="mb-3 flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fuel
                  </span>
                </div>

                {/* All tanks master control */}
                <div className="mb-3 rounded-md bg-secondary/60 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">All Tanks</span>
                    <span className="font-mono text-foreground">
                      {overallFuelPct}%
                      <span className="ml-1 text-muted-foreground">
                        ({formatWeight(totalFuelLbs, weightUnit)})
                      </span>
                    </span>
                  </div>
                  <Slider
                    value={[overallFuelPct]}
                    onValueChange={(v) => setAllTanksPercentage(v[0])}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>

                {/* Per-tank sliders */}
                <div className="space-y-3">
                  {tankNames.map((name, i) => {
                    const cap = tankCapacities[i] ?? 0;
                    const pct = tankPercentages[i] ?? 0;
                    const weightLbs = (cap * pct) / 100;

                    return (
                      <SliderRow
                        key={i}
                        label={name}
                        value={pct}
                        max={100}
                        step={1}
                        onChange={(v) => setTankPercentage(i, v)}
                        formatValue={(v) =>
                          `${Math.round(v)}% (${formatWeight(weightLbs, weightUnit)})`
                        }
                      />
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Right: Weight Donut */}
            <div className="flex w-60 shrink-0 flex-col items-center justify-center p-5">
              <WeightDonut
                emptyWeight={selectedAircraft.emptyWeight}
                payloadWeight={totalPayloadLbs}
                fuelWeight={totalFuelLbs}
                maxWeight={selectedAircraft.maxWeight}
                weightUnit={weightUnit}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-border bg-card px-4 py-2.5">
            <Button onClick={onClose} size="sm">
              Done
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Shared Slider Row ───────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  max,
  step,
  onChange,
  formatValue,
  formatMax,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (v: number) => string;
  formatMax?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {formatValue(value)}
          {formatMax && <span className="ml-1 text-muted-foreground/50">/ {formatMax(max)}</span>}
        </span>
      </div>
      <Slider value={[value]} onValueChange={(v) => onChange(v[0])} min={0} max={max} step={step} />
    </div>
  );
}
