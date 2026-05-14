import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, RefreshCcw, ScrollText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/helpers';
import { type LogEntry, type LogLevel, parseLog } from '@/lib/xplaneServices/log/parseLog';
import { useXplaneLogQuery } from '@/queries';
import { SettingsEmptyState, SettingsHeader, SettingsSectionBlock } from '../primitives';

type LevelFilter = 'all' | 'errors-warnings' | 'errors' | 'warnings';

const FILTER_OPTIONS: { id: LevelFilter; labelKey: string }[] = [
  { id: 'errors-warnings', labelKey: 'settings.logs.filter.errorsWarnings' },
  { id: 'errors', labelKey: 'settings.logs.filter.errors' },
  { id: 'warnings', labelKey: 'settings.logs.filter.warnings' },
  { id: 'all', labelKey: 'settings.logs.filter.all' },
];

interface LogsSectionProps {
  active: boolean;
}

export function LogsSection({ active }: LogsSectionProps) {
  const { t } = useTranslation();
  const query = useXplaneLogQuery(active);
  const [filter, setFilter] = useState<LevelFilter>('errors-warnings');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [showHeader, setShowHeader] = useState(false);

  const handleRefresh = () => {
    query.refetch();
  };

  const handleOpenExternal = async () => {
    const r = await window.xpLogAPI.openExternal();
    if (!r.ok) {
      const msg =
        r.reason === 'no-log'
          ? t('settings.logs.empty.noLog')
          : r.reason === 'no-path'
            ? t('settings.logs.empty.noPath')
            : (r.message ?? t('settings.logs.openFailed'));
      toast.error(msg);
    }
  };

  const Header = (
    <SettingsHeader
      icon={ScrollText}
      title={t('settings.logs.title')}
      description={t('settings.logs.description')}
    />
  );

  const Toolbar = () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={query.isFetching}>
        <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
        {t('settings.logs.refresh')}
      </Button>
      <Button variant="outline" size="sm" onClick={handleOpenExternal}>
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
        {t('settings.logs.openExternal')}
      </Button>
    </div>
  );

  if (query.isLoading || query.data === undefined) {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar />
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const result = query.data;

  if (result.kind === 'no-path') {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar />
        <SettingsEmptyState message={t('settings.logs.empty.noPath')} />
      </div>
    );
  }

  if (result.kind === 'no-log') {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar />
        <SettingsEmptyState message={t('settings.logs.empty.noLog')} />
      </div>
    );
  }

  if (result.kind === 'error') {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-mono text-xs text-destructive">{result.message}</p>
        </div>
      </div>
    );
  }

  const parsed = parseLog(result.data);
  const filtered = applyFilters(parsed.entries, filter, deferredSearch);

  return (
    <div className="space-y-6">
      {Header}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {result.truncated ? (
          <p className="text-xs text-muted-foreground">
            {t('settings.logs.truncatedNotice', {
              shownMb: 5,
              totalMb: Math.round(result.fullByteSize / 1_000_000),
            })}
          </p>
        ) : (
          <span />
        )}
        <Toolbar />
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings.logs.searchPlaceholder')}
            className="h-8 pl-8 font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              variant={filter === opt.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setFilter(opt.id)}
            >
              {t(opt.labelKey)}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {t('settings.logs.entryCount', {
              shown: filtered.length,
              total: parsed.entries.length,
            })}
          </span>
        </div>
      </div>

      {parsed.header.length > 0 && (
        <Collapsible open={showHeader} onOpenChange={setShowHeader}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-mx-2 justify-start px-2">
              <ScrollText className="mr-2 h-4 w-4" />
              {showHeader
                ? t('settings.logs.hideHeader')
                : t('settings.logs.showHeader', { count: parsed.header.length })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/10 p-3 font-mono text-xs text-muted-foreground">
              {parsed.header.join('\n')}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      <SettingsSectionBlock title={t('settings.logs.entriesHeader')} icon={ScrollText}>
        {filtered.length === 0 ? (
          <SettingsEmptyState message={t('settings.logs.empty.noMatches')} />
        ) : (
          <div className="rounded-lg border">
            <ul className="divide-y divide-border">
              {filtered.map((e) => (
                <LogRow key={e.lineNumber} entry={e} />
              ))}
            </ul>
          </div>
        )}
      </SettingsSectionBlock>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground/70">
        {entry.timestamp}
      </span>
      <Badge className={cn('shrink-0 uppercase', levelChipClass(entry.level))}>{entry.level}</Badge>
      <Badge variant="outline" className="shrink-0 font-mono text-xs">
        {entry.category}
      </Badge>
      <p className="min-w-0 flex-1 break-words font-mono text-xs text-foreground">
        {entry.message}
      </p>
    </li>
  );
}

function applyFilters(entries: LogEntry[], filter: LevelFilter, search: string): LogEntry[] {
  const byLevel = applyLevelFilter(entries, filter);
  const q = search.trim().toLowerCase();
  if (!q) return byLevel;
  return byLevel.filter(
    (e) => e.message.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  );
}

function applyLevelFilter(entries: LogEntry[], filter: LevelFilter): LogEntry[] {
  if (filter === 'all') return entries;
  if (filter === 'errors') return entries.filter((e) => e.level === 'error');
  if (filter === 'warnings') return entries.filter((e) => e.level === 'warn');
  return entries.filter((e) => e.level === 'error' || e.level === 'warn');
}

function levelChipClass(level: LogLevel): string {
  if (level === 'error') return 'bg-destructive/10 text-destructive';
  if (level === 'warn') return 'bg-warning/10 text-warning';
  return 'bg-info/10 text-info';
}
