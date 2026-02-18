import * as React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

/**
 * X-Plane Tile Grid Component
 * Used for aircraft selection, livery selection, etc.
 *
 * States per X-Plane V11 UI Component Library:
 * - Default: bg-secondary, no border
 * - Hover: bg-accent, subtle border appears
 * - Selected: cyan border (#1DA0F2), subtle cyan tint bg
 * - Disabled: very faded, no interaction
 */

interface TileProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  disabled?: boolean;
  showSettingsIcon?: boolean;
  onSettingsClick?: (e: React.MouseEvent) => void;
}

const Tile = React.forwardRef<HTMLDivElement, TileProps>(
  (
    { className, children, selected, disabled, showSettingsIcon, onSettingsClick, ...props },
    ref
  ) => {
    const handleSettingsClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSettingsClick?.(e);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'group relative cursor-pointer rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          selected
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-transparent bg-secondary text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
          disabled && 'pointer-events-none cursor-not-allowed opacity-40',
          className
        )}
        {...props}
      >
        {children}
        {showSettingsIcon && (
          <button
            type="button"
            onClick={handleSettingsClick}
            className={cn(
              'absolute bottom-2 right-2 rounded p-1 opacity-0 transition-opacity hover:bg-muted/50 group-hover:opacity-70',
              selected && 'opacity-70'
            )}
            aria-label="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);
Tile.displayName = 'Tile';

interface TileImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

const TileImage = React.forwardRef<HTMLImageElement, TileImageProps>(
  ({ className, fallback, src, alt, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);

    if (!src || hasError) {
      return (
        <div
          className={cn(
            'flex items-center justify-center bg-muted text-muted-foreground',
            className
          )}
        >
          {fallback}
        </div>
      );
    }

    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className={cn('object-cover', className)}
        {...props}
      />
    );
  }
);
TileImage.displayName = 'TileImage';

const TileContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-0.5 overflow-hidden', className)} {...props} />
  )
);
TileContent.displayName = 'TileContent';

const TileTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('truncate text-sm font-medium', className)} {...props} />
  )
);
TileTitle.displayName = 'TileTitle';

const TileDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('truncate text-xs text-muted-foreground', className)} {...props} />
  )
);
TileDescription.displayName = 'TileDescription';

export { Tile, TileImage, TileContent, TileTitle, TileDescription };
