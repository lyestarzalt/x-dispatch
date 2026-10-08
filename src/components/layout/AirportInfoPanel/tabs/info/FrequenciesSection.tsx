import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FrequencyRow, type MergedFreqRow } from './FrequencyRow';

export const FREQ_VISIBLE_DEFAULT = 5;

export function FrequenciesSection({
  visible,
  totalCount,
  showAll,
  onToggle,
  vatsimEnabled,
  onlineCount,
}: {
  visible: MergedFreqRow[];
  totalCount: number;
  showAll: boolean;
  onToggle: () => void;
  vatsimEnabled: boolean;
  onlineCount: number;
}) {
  const { t } = useTranslation();
  const hidden = totalCount - visible.length;
  const collapsible = totalCount > FREQ_VISIBLE_DEFAULT;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h4 className="xp-section-heading mb-0 border-b-0">{t('airportInfo.frequencies')}</h4>
        {vatsimEnabled && onlineCount > 0 && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="bg-cat-emerald h-1.5 w-1.5 animate-pulse rounded-full" />
            <span>
              <span className="text-foreground font-mono tabular-nums">{onlineCount}</span>{' '}
              {t('common.online')}
            </span>
          </span>
        )}
      </div>
      <ul className="space-y-1 overflow-hidden rounded-lg">
        {visible.map((row) => (
          <FrequencyRow
            key={row.id}
            row={row}
            expanded={expandedIds.has(row.id)}
            onToggle={() => toggleExpand(row.id)}
          />
        ))}
      </ul>
      {collapsible && (
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground mt-2 h-8 w-full justify-center gap-1.5 text-xs"
        >
          {showAll ? (
            <>
              <ChevronDown className="h-3 w-3 rotate-180" />
              {t('common.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t('common.showAll')} · {hidden} {t('sidebar.more')}
            </>
          )}
        </Button>
      )}
    </section>
  );
}
