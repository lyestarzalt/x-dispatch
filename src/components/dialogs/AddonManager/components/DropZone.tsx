// src/components/dialogs/AddonManager/components/DropZone.tsx
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Upload } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

interface DropZoneProps {
  onFilesDropped: (paths: string[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesDropped, disabled }: DropZoneProps) {
  const { t } = useTranslation();
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

      const file = e.dataTransfer.files[0];
      if (!file) return;
      // Use Electron's webUtils API to get file path (works with sandbox: true)
      try {
        const filePath = window.appAPI.getFilePathForDrop(file);
        if (filePath) {
          onFilesDropped([filePath]);
        }
      } catch {
        // Non-local file dropped (e.g., from browser) — ignore
      }
    },
    [disabled, onFilesDropped]
  );

  const handleClick = useCallback(async () => {
    if (disabled) return;

    const result = await window.addonManagerAPI.installer.browse();
    if (result.ok && result.value.length > 0) {
      // Only take the first file
      const firstFile = result.value[0];
      if (firstFile) onFilesDropped([firstFile]);
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
      aria-label={t('addonManager.installer.dropZone.ariaLabel')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'group relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200',
        isDragOver
          ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
          : 'border-muted-foreground/20 bg-gradient-to-b from-muted/20 to-muted/5',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-primary/40 hover:bg-muted/30 hover:shadow-lg'
      )}
    >
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Icon */}
      <div
        className={cn(
          'relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200',
          isDragOver
            ? 'scale-110 bg-primary/20 text-primary'
            : 'bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
        )}
      >
        <Upload
          className={cn(
            'h-7 w-7 transition-transform duration-200',
            isDragOver && 'animate-bounce'
          )}
        />
      </div>

      {/* Text */}
      <p
        className={cn(
          'text-sm font-semibold transition-colors',
          isDragOver ? 'text-primary' : 'text-foreground'
        )}
      >
        {t('addonManager.installer.dropZone.title')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('addonManager.installer.dropZone.subtitle')}
      </p>

      {/* Browse button hint */}
      <div
        className={cn(
          'mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
          isDragOver
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground group-hover:border-primary/30 group-hover:text-primary'
        )}
      >
        <FolderOpen className="h-3.5 w-3.5" />
        {t('addonManager.installer.dropZone.browse')}
      </div>
    </div>
  );
}
