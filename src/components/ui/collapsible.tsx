import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

/**
 * Pre-styled collapsible section header for use inside dropdown menus.
 * Shows a label with a rotating chevron that clearly signals expand/collapse.
 */
const CollapsibleSectionTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger> & {
    indicator?: React.ReactNode;
  }
>(({ className, children, indicator, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleTrigger
    ref={ref}
    className={cn(
      'group flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 transition-colors hover:bg-accent/50',
      className
    )}
    {...props}
  >
    <ChevronRight className="mr-1.5 h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
    <span className="flex-1 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
    {indicator}
  </CollapsiblePrimitive.CollapsibleTrigger>
));
CollapsibleSectionTrigger.displayName = 'CollapsibleSectionTrigger';

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleSectionTrigger };
