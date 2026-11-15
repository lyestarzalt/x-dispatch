import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, ChevronDown, ExternalLink, RefreshCcw, ScrollText, Search } from 'lucide-react';
import { DesktopOnly } from '@/components/remote/DesktopOnly';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { type LogAnalysis, analyzeLog } from '@/lib/health/logAnalysis';
import { cn } from '@/lib/utils/helpers';
import { toastError } from '@/lib/utils/toastError';
import { type LogEntry, type LogLevel, parseLog } from '@/lib/xplaneServices/log/parseLog';
import { useXplaneLogQuery } from '@/queries';
import { SettingsEmptyState, SettingsHeader } from '../primitives';

type LevelFilter = 'errors' | 'warnings' | 'all';

const FILTER_OPTIONS: { id: LevelFilter; labelKey: string }[] = [
  { id: 'errors', labelKey: 'settings.logs.filter.errors' },
  { id: 'warnings', labelKey: 'settings.logs.filter.warnings' },
  { id: 'all', labelKey: 'settings.logs.filter.all' },
];

/** Rows rendered before "Show all": a scenery with a broken library repeats one line thousands of times. */
const ROWS_SHOWN = 150;

interface LogsSectionProps {
  active: boolean;
}

/** One distinct message with how often it appeared and when it last did. */
interface LogGroup {
  key: string;
  first: LogEntry;
  lastTimestamp: string;
  count: number;
}

export function LogsSection({ active }: LogsSectionProps) {
  const { t } = useTranslation();
  const query = useXplaneLogQuery(active);
  const [filter, setFilter] = useState<LevelFilter>('errors');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [showAll, setShowAll] = useState(false);
  const [listOpen, setListOpen] = useState<boolean | null>(null);

  const handleOpenExternal = async () => {
    const r = await window.xpLogAPI.openExternal();
    if (!r.ok) {
      const msg =
        r.reason === 'no-log'
          ? t('settings.logs.empty.noLog')
          : r.reason === 'no-path'
            ? t('settings.logs.empty.noPath')
            : (r.message ?? t('settings.logs.openFailed'));
      toastError('logs', msg);
    }
  };

  const text = query.data?.kind === 'ok' ? query.data.data : null;
  const parsed = useMemo(() => (text === null ? null : parseLog(text)), [text]);
  const analysis = useMemo(() => (text === null ? null : analyzeLog(text)), [text]);
  const groups = useMemo(
    () => (parsed ? groupEntries(applyFilters(parsed.entries, filter, deferredSearch)) : []),
    [parsed, filter, deferredSearch]
  );

  const header = (
    <SettingsHeader
      icon={ScrollText}
      title={t('settings.logs.title')}
      description={t('settings.logs.description')}
    />
  );

  const toolbar = (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => query.refetch()}
        disabled={query.isFetching}
        tooltip={t('settings.logs.refresh')}
      >
        <RefreshCcw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')} />
      </Button>
      <DesktopOnly>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleOpenExternal}
          tooltip={t('settings.logs.openExternal')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </DesktopOnly>
    </div>
  );

  if (query.isLoading || query.data === undefined) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  const result = query.data;
  if (result.kind !== 'ok' || !parsed || !analysis) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex items-center justify-between gap-3">
          <span />
          {toolbar}
        </div>
        {result.kind === 'error' ? (
          <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-6">
            <p className="text-destructive font-mono text-xs">{result.message}</p>
          </div>
        ) : (
          <SettingsEmptyState
            message={
              result.kind === 'no-path'
                ? t('settings.logs.empty.noPath')
                : t('settings.logs.empty.noLog')
            }
          />
        )}
      </div>
    );
  }

  // A clean run keeps its error lines folded away; a crash opens them.
  const open = listOpen ?? (!analysis.cleanShutdown || !analysis.isXPlaneLog);
  const errorCount = parsed.entries.filter((e) => e.level === 'error').length;
  const visible = showAll ? groups : groups.slice(0, ROWS_SHOWN);

  return (
    <div className="space-y-6">
      {header}

      <SessionCard
        analysis={analysis}
        truncatedMb={result.truncated ? Math.round(result.fullByteSize / 1_000_000) : null}
        toolbar={toolbar}
        onPick={(line) => {
          setSearch(messageOf(line));
          setFilter('all');
          setListOpen(true);
        }}
      />

      <Collapsible open={open} onOpenChange={setListOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-mx-2 justify-start px-2">
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
            {t('settings.logs.lines', { count: errorCount })}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('settings.logs.searchPlaceholder')}
                className="h-8 pl-8 font-mono text-xs"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  variant={filter === opt.id ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => setFilter(opt.id)}
                >
                  {t(opt.labelKey)}
                </Button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <SettingsEmptyState message={t('settings.logs.empty.noMatches')} />
          ) : (
            <div className="rounded-lg border">
              <ul className="divide-border divide-y">
                {visible.map((group) => (
                  <LogRow key={group.key} group={group} />
                ))}
              </ul>
              {groups.length > visible.length && (
                <div className="border-border border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAll(true)}
                  >
                    {t('settings.logs.showAll', { count: groups.length })}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** The message part of a raw log line: after the timestamp and the level tag. */
function messageOf(line: string): string {
  const match = /^\d+:\d+:\d+\.\d+\s+[A-Z]\/[A-Z/]+:\s*(.*)$/.exec(line.trim());
  return (match?.[1] ?? line).trim().slice(0, 80);
}

/** What the last session was: how it ended, what it ran on, and the known trouble lines. */
function SessionCard({
  analysis,
  truncatedMb,
  toolbar,
  onPick,
}: {
  analysis: LogAnalysis;
  truncatedMb: number | null;
  toolbar: React.ReactNode;
  onPick: (line: string) => void;
}) {
  const { t } = useTranslation();
  const [showContext, setShowContext] = useState(false);

  const ending = !analysis.isXPlaneLog
    ? { key: 'unknown', className: 'bg-muted text-muted-foreground' }
    : analysis.cleanShutdown
      ? { key: 'clean', className: 'bg-success/10 text-success' }
      : analysis.crashLine !== null
        ? { key: 'crashed', className: 'bg-destructive/10 text-destructive' }
        : { key: 'stopped', className: 'bg-warning/10 text-warning' };
  const facts = [
    analysis.version && `${t('settings.logs.session.version')} ${analysis.version}`,
    analysis.gpu,
    analysis.driver && `${t('settings.logs.session.driver')} ${analysis.driver}`,
  ].filter((fact): fact is string => !!fact);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="xp-section-heading flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t('settings.logs.session.title')}
        </h3>
        {toolbar}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn('shrink-0', ending.className)}>
          {t(`settings.logs.session.${ending.key}`)}
        </Badge>
        {analysis.beta && (
          <Badge variant="outline" className="shrink-0">
            {t('settings.logs.session.beta')}
          </Badge>
        )}
        {truncatedMb !== null && (
          <span className="text-muted-foreground shrink-0 text-xs">
            {t('settings.logs.truncatedNotice', { shownMb: 5, totalMb: truncatedMb })}
          </span>
        )}
      </div>
      {facts.length > 0 && (
        <p
          className="text-muted-foreground min-w-0 truncate font-mono text-xs"
          title={facts.join(' · ')}
        >
          {facts.join(' · ')}
        </p>
      )}
      {analysis.isXPlaneLog &&
        (analysis.issues.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('settings.logs.session.noIssues')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {analysis.issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => onPick(issue.line)}
                title={issue.line}
                className="min-w-0"
              >
                <Badge
                  className={cn(
                    'max-w-full gap-1 text-xs',
                    issue.severity === 'error'
                      ? 'bg-destructive/10 text-destructive'
                      : issue.severity === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-info/10 text-info'
                  )}
                >
                  <span className="truncate">{t(`settings.logs.issues.${issue.id}`)}</span>
                  {issue.count > 1 && (
                    <span className="tabular-nums">
                      {t('settings.logs.session.times', { count: issue.count })}
                    </span>
                  )}
                </Badge>
              </button>
            ))}
          </div>
        ))}
      {analysis.crashed && analysis.context.length > 0 && (
        <Collapsible open={showContext} onOpenChange={setShowContext}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-mx-2 justify-start px-2">
              <ScrollText className="h-4 w-4" />
              {t('settings.logs.session.context', { count: analysis.context.length })}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="border-border bg-muted/10 text-muted-foreground mt-2 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
              {analysis.context.join('\n')}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function LogRow({ group }: { group: LogGroup }) {
  const { t } = useTranslation();
  const { first } = group;
  return (
    <li className="flex items-start gap-3 px-3 py-1.5">
      <span className="text-muted-foreground/70 mt-0.5 shrink-0 font-mono text-xs tabular-nums">
        {group.lastTimestamp}
      </span>
      <span className={cn('mt-0.5 shrink-0 font-mono text-xs', levelClass(first.level))}>
        {first.category}
      </span>
      <p className="text-foreground min-w-0 flex-1 font-mono text-xs break-words">
        {first.message}
      </p>
      {group.count > 1 && (
        <Badge variant="outline" className="shrink-0 font-mono text-xs tabular-nums">
          {t('settings.logs.session.times', { count: group.count })}
        </Badge>
      )}
    </li>
  );
}

/** Identical messages collapse into one row; the row keeps the last time it appeared. */
function groupEntries(entries: LogEntry[]): LogGroup[] {
  const groups = new Map<string, LogGroup>();
  for (const entry of entries) {
    const key = `${entry.level}|${entry.category}|${entry.message}`;
    const group = groups.get(key);
    if (group) {
      group.count++;
      group.lastTimestamp = entry.timestamp;
    } else {
      groups.set(key, { key, first: entry, lastTimestamp: entry.timestamp, count: 1 });
    }
  }
  return [...groups.values()];
}

function applyFilters(entries: LogEntry[], filter: LevelFilter, search: string): LogEntry[] {
  const byLevel =
    filter === 'all'
      ? entries
      : entries.filter((e) => e.level === (filter === 'errors' ? 'error' : 'warn'));
  const q = search.trim().toLowerCase();
  if (!q) return byLevel;
  return byLevel.filter(
    (e) => e.message.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  );
}

function levelClass(level: LogLevel): string {
  if (level === 'error') return 'text-destructive';
  if (level === 'warn') return 'text-warning';
  return 'text-muted-foreground';
}
