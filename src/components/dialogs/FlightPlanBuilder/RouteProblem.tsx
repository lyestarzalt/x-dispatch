import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RouteToken } from '@/lib/flightplan/builder/types';
import { cn } from '@/lib/utils/helpers';

/** A route token the resolver could not use, with the reason in plain sight rather than on hover. */
export function RouteProblem({ token, onRemove }: { token: RouteToken; onRemove: () => void }) {
  const { t } = useTranslation();
  const issue = token.issue ?? (token.status === 'unknown' ? 'notFound' : undefined);
  return (
    <li className="flex min-w-0 items-start gap-2 text-xs">
      <span
        className={cn(
          'shrink-0 rounded-sm border px-1.5 py-0.5 font-mono',
          token.status === 'unknown'
            ? 'border-warning/40 bg-warning/10 text-warning'
            : 'border-destructive/40 bg-destructive/10 text-destructive'
        )}
      >
        {token.text}
      </span>
      {issue && (
        <span className="text-muted-foreground min-w-0 flex-1 pt-0.5">
          {t(`planBuilder.issues.${issue}`)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground ml-auto shrink-0"
        onClick={onRemove}
        tooltip={t('planBuilder.removeToken', { token: token.text })}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
