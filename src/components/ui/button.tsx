import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils/helpers';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-xp-accent-hover active:bg-xp-accent-muted',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
        outline:
          'border border-border bg-card text-foreground hover:bg-accent hover:text-primary active:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent active:bg-muted',
        ghost: 'hover:bg-accent hover:text-xp-accent-glow active:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Renders a shadcn Tooltip around the button. Also sets aria-label when not provided. */
  tooltip?: string;
  /** Which side the tooltip appears on. @default 'top' */
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, tooltip, tooltipSide = 'top', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const button = (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={props['aria-label'] ?? tooltip}
        {...props}
      />
    );

    if (!tooltip) return button;

    return (
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{button}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Content
          side={tooltipSide}
          sideOffset={4}
          className="z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <p>{tooltip}</p>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Root>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
