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
    className={cn('relative flex w-full touch-none items-center select-none', className)}
    {...props}
  >
    <SliderPrimitive.Track className="bg-muted relative h-1 w-full grow overflow-hidden rounded-full">
      <SliderPrimitive.Range className="bg-primary absolute h-full" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="bg-foreground ring-offset-background focus-visible:ring-ring block h-4 w-4 rounded-full shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
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
          <span className="text-muted-foreground text-xs">{label}</span>
          <div className="flex items-center gap-1">
            {showInput ? (
              <Input
                type="number"
                value={displayValue}
                onChange={handleInputChange}
                disabled={disabled}
                className="border-border bg-secondary h-6 w-16 px-2 text-right font-mono text-xs"
              />
            ) : (
              <span className="text-foreground font-mono text-sm">{displayValue}</span>
            )}
            {unit && <span className="text-muted-foreground text-xs">{unit}</span>}
          </div>
        </div>

        {/* Slider */}
        <SliderPrimitive.Root
          ref={ref}
          value={value}
          disabled={disabled}
          className="relative flex w-full touch-none items-center select-none"
          {...props}
        >
          <SliderPrimitive.Track className="bg-muted relative h-1 w-full grow overflow-hidden rounded-full">
            <SliderPrimitive.Range className="bg-primary absolute h-full" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="bg-foreground ring-offset-background focus-visible:ring-ring block h-4 w-4 rounded-full shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>

        {/* Bottom row: Min/Max labels */}
        {(minLabel || maxLabel) && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px]">{minLabel}</span>
            <span className="text-muted-foreground text-[10px]">{maxLabel}</span>
          </div>
        )}
      </div>
    );
  }
);
LabeledSlider.displayName = 'LabeledSlider';

export { Slider, LabeledSlider };
