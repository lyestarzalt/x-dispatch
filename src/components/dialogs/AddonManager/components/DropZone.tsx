// src/components/dialogs/AddonManager/components/DropZone.tsx
import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

// Electron extends File with a path property for local files
interface ElectronFile extends File {
  path: string;
}

interface DropZoneProps {
  onFilesDropped: (paths: string[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesDropped, disabled }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files) as ElectronFile[];
      const paths = files.map((f) => f.path).filter(Boolean);
      if (paths.length > 0) {
        onFilesDropped(paths);
      }
    },
    [disabled, onFilesDropped]
  );

  const handleClick = useCallback(async () => {
    if (disabled) return;

    const result = await window.addonManagerAPI.installer.browse();
    if (result.ok && result.value.length > 0) {
      onFilesDropped(result.value);
    }
  }, [disabled, onFilesDropped]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Drop or click to select addon archive files"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
        isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-primary/50 hover:bg-muted/50'
      )}
    >
      <Upload
        className={cn('mb-3 h-10 w-10', isDragOver ? 'text-primary' : 'text-muted-foreground')}
      />
      <p className="text-sm font-medium">Drop or click to select files</p>
      <p className="mt-1 text-xs text-muted-foreground">ZIP, 7z, or RAR archives</p>
    </div>
  );
}
