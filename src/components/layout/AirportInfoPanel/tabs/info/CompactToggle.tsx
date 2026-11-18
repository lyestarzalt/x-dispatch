import { useTranslation } from 'react-i18next';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Switches a list between its active items and all of them, as on the flight plan card. */
export function CompactToggle({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const label = compact ? t('common.showAll') : t('common.showLess');
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onToggle}
      tooltip={label}
      aria-label={label}
      className="text-muted-foreground/60 hover:text-foreground"
    >
      {compact ? (
        <ChevronsUpDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronsDownUp className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
