import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border', className)}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center gap-2 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-xp-accent-hover',
        className
      )}
      {...props}
    >
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-xp-accent-hover group-data-[state=open]:hidden" />
      <Minus className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-xp-accent-hover group-data-[state=open]:block" />
      {children}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn('pb-4 pt-0', className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = AccordionPrimitive.Content.displayName;

/**
 * X-Plane Table Accordion - used within cards/panels with count badges
 * Wraps the accordion in a subtle card background
 */
const TableAccordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root
    ref={ref}
    className={cn('rounded-lg bg-secondary/50 px-3', className)}
    {...props}
  />
));
TableAccordion.displayName = 'TableAccordion';

const TableAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border/50 last:border-b-0', className)}
    {...props}
  />
));
TableAccordionItem.displayName = 'TableAccordionItem';

interface TableAccordionTriggerProps extends React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> {
  count?: number;
}

const TableAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  TableAccordionTriggerProps
>(({ className, children, count, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center gap-2 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-xp-accent-hover',
        className
      )}
      {...props}
    >
      <Plus className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-xp-accent-hover group-data-[state=open]:hidden" />
      <Minus className="hidden h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-xp-accent-hover group-data-[state=open]:block" />
      <span className="flex-1 text-left">{children}</span>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
TableAccordionTrigger.displayName = 'TableAccordionTrigger';

const TableAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn('pb-3 pt-1', className)}>{children}</div>
  </AccordionPrimitive.Content>
));
TableAccordionContent.displayName = 'TableAccordionContent';

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  TableAccordion,
  TableAccordionItem,
  TableAccordionTrigger,
  TableAccordionContent,
};
