import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils/helpers';
import { Input } from './input';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full bg-foreground shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

/**
 * X-Plane style labeled slider with:
 * - Label on top-left
 * - Value display (optional editable input) on top-right
 * - Slider track
 * - Optional min/max labels below
 */
interface LabeledSliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label: string;
  value: number[];
  unit?: string;
  minLabel?: string;
  maxLabel?: string;
  showInput?: boolean;
  onInputChange?: (value: number) => void;
}

const LabeledSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  LabeledSliderProps
>(
  (
    {
      className,
      label,
      value,
      unit,
      minLabel,
      maxLabel,
      showInput = false,
      onInputChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const displayValue = value[0];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      if (!isNaN(newValue) && onInputChange) {
        onInputChange(newValue);
      }
    };

    return (
      <div className={cn('w-full', disabled && 'opacity-50', className)}>
        {/* Top row: Label and Value */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className="flex items-center gap-1">
            {showInput ? (
              <Input
                type="number"
                value={displayValue}
                onChange={handleInputChange}
                disabled={disabled}
                className="h-6 w-16 border-border bg-secondary px-2 text-right font-mono text-xs"
              />
            ) : (
              <span className="font-mono text-sm text-foreground">{displayValue}</span>
            )}
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
        </div>

        {/* Slider */}
        <SliderPrimitive.Root
          ref={ref}
          value={value}
          disabled={disabled}
          className="relative flex w-full touch-none select-none items-center"
          {...props}
        >
          <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
            <SliderPrimitive.Range className="absolute h-full bg-primary" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full bg-foreground shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>

        {/* Bottom row: Min/Max labels */}
        {(minLabel || maxLabel) && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{minLabel}</span>
            <span className="text-[10px] text-muted-foreground">{maxLabel}</span>
          </div>
        )}
      </div>
    );
  }
);
LabeledSlider.displayName = 'LabeledSlider';

export { Slider, LabeledSlider };
