import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/helpers';
import { filterNotices } from '@/lib/utils/thirdPartyNotices';
import { useThirdPartyNotices } from '@/queries';
import type { ThirdPartyNotice } from '@/types/notices';

interface ThirdPartyNoticesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NoticeRow({ notice }: { notice: ThirdPartyNotice }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="xp-value min-w-0 truncate">
          {notice.name}
          {notice.version && (
            <span className="text-muted-foreground ml-1.5 text-xs">{notice.version}</span>
          )}
        </span>
        <Badge variant="outline" className="ml-auto shrink-0 font-mono text-[10px]">
          {notice.license}
        </Badge>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {notice.repository && (
            <Button
              variant="link"
              className="h-auto p-0 font-mono text-xs"
              onClick={() => window.appAPI.openExternal(notice.repository!)}
            >
              <span className="truncate">{notice.repository}</span>
            </Button>
          )}
          <pre className="bg-secondary/50 text-muted-foreground max-h-72 overflow-auto rounded px-3 py-2 font-mono text-[11px] leading-snug whitespace-pre-wrap">
            {notice.text}
          </pre>
        </div>
      )}
    </div>
  );
}

/** Every third-party component shipped with the app, with its licence text, searchable. */
export function ThirdPartyNoticesDialog({ open, onOpenChange }: ThirdPartyNoticesDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useThirdPartyNotices(open);
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const shown = useMemo(() => filterNotices(entries, query), [entries, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
            <ScrollText className="text-primary h-5 w-5" />
          </div>
          <DialogTitle>{t('thirdPartyNotices.title')}</DialogTitle>
          <DialogDescription>{t('thirdPartyNotices.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('thirdPartyNotices.search')}
            className="h-8 text-sm"
          />
          <span className="text-muted-foreground shrink-0 text-xs">
            {t('thirdPartyNotices.count', { count: shown.length })}
          </span>
        </div>

        <ScrollArea className="h-[60vh] pr-3">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t('thirdPartyNotices.noResults')}
            </p>
          ) : (
            <div className="space-y-2">
              {shown.map((notice) => (
                <NoticeRow key={`${notice.name}@${notice.version ?? ''}`} notice={notice} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
