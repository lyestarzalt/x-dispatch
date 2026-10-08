import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { RouteToken } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';

export function ProblemChip({ token, onRemove }: { token: RouteToken; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs',
        token.status === 'unknown'
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-destructive/40 bg-destructive/10 text-destructive'
      )}
      title={token.issue ? t(`planBuilder.issues.${token.issue}`) : undefined}
    >
      {token.text}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-foreground -mr-0.5 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label={t('planBuilder.removeToken', { token: token.text })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
