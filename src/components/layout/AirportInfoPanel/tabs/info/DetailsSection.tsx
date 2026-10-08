import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DetailsSection({
  rawMetar,
  expanded,
  onToggle,
}: {
  rawMetar: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground h-7 w-full justify-start gap-1 px-1 text-xs"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {t('airportInfo.rawMetar')}
      </Button>
      {expanded && (
        <div className="bg-muted/30 mt-1.5 rounded p-2">
          <p className="text-muted-foreground text-2xs font-mono leading-relaxed break-all">
            {rawMetar}
          </p>
        </div>
      )}
    </section>
  );
}
