import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type ParseResult, parseLog } from '@/lib/xplaneServices/log/parseLog';
import { useXplaneLogQuery } from '@/queries';
import { LogsReportDialog } from './LogsReportDialog';

interface LogsSectionProps {
  active: boolean;
}

export function LogsSection({ active }: LogsSectionProps) {
  const { t } = useTranslation();
  const query = useXplaneLogQuery(active);
  const [showRaw, setShowRaw] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handleRefresh = () => {
    query.refetch();
  };

  const PageHeader = (
    <div>
      <h3 className="xp-section-heading">{t('settings.logs.title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('settings.logs.description')}</p>
    </div>
  );

  const Toolbar = ({ canReport }: { canReport: boolean }) => (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={query.isFetching}>
        <RefreshCcw className={`mr-2 h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />
        {t('settings.logs.refresh')}
      </Button>
      {canReport && (
        <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
          {t('settings.logs.report')}
        </Button>
      )}
    </div>
  );

  if (query.isLoading || query.data === undefined) {
    return (
      <div className="space-y-6">
        {PageHeader}
        <Toolbar canReport={false} />
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const result = query.data;

  if (result.kind === 'no-path') {
    return (
      <div className="space-y-6">
        {PageHeader}
        <Toolbar canReport={false} />
        <Card className="bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('settings.logs.empty.noPath')}</p>
        </Card>
      </div>
    );
  }

  if (result.kind === 'no-log') {
    return (
      <div className="space-y-6">
        {PageHeader}
        <Toolbar canReport={false} />
        <Card className="bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('settings.logs.empty.noLog')}</p>
        </Card>
      </div>
    );
  }

  if (result.kind === 'error') {
    return (
      <div className="space-y-6">
        {PageHeader}
        <Toolbar canReport={false} />
        <Card className="bg-destructive/10 p-6">
          <p className="font-mono text-xs text-destructive">{result.message}</p>
        </Card>
      </div>
    );
  }

  const parsed: ParseResult = parseLog(result.data);
  const isAllClear = parsed.recognized.length === 0 && parsed.otherIssues.length === 0;

  return (
    <div className="space-y-6">
      {PageHeader}
      <div className="flex items-center justify-between gap-2">
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
        <Toolbar canReport />
      </div>

      {parsed.recognized.length > 0 && (
        <section className="space-y-2">
          <h4 className="xp-section-heading">
            {t('settings.logs.recognizedIssuesHeader', { count: parsed.recognized.length })}
          </h4>
          <ul className="space-y-2">
            {parsed.recognized.map((m) => (
              <li key={`${m.lineNumber}-${m.id}`}>
                <Card className="bg-muted/20 p-3">
                  <div className="flex items-start gap-3">
                    <Badge className={levelChipClass(m.level)}>{m.level}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{t(`logs.patterns.${m.id}`)}</p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {t('settings.logs.lineNumber', { line: m.lineNumber })} · {m.line}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {parsed.otherIssues.length > 0 && (
        <section className="space-y-2">
          <h4 className="xp-section-heading">
            {t('settings.logs.otherIssuesHeader', { count: parsed.otherIssues.length })}
          </h4>
          <ul className="space-y-2">
            {parsed.otherIssues.map((m) => (
              <li key={`${m.lineNumber}-${m.category}`}>
                <Card className="bg-muted/10 p-3">
                  <div className="flex items-start gap-3">
                    <Badge className={levelChipClass(m.level)}>{m.level}</Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      {m.category}
                    </Badge>
                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                      {t('settings.logs.lineNumber', { line: m.lineNumber })} · {m.line}
                    </p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAllClear && (
        <Card className="bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('settings.logs.empty.allClear')}</p>
        </Card>
      )}

      <Collapsible open={showRaw} onOpenChange={setShowRaw}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            {showRaw ? t('settings.logs.hideFullLog') : t('settings.logs.showFullLog')}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card className="bg-muted/10 p-3">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
              {result.data}
            </pre>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <LogsReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        rawLog={result.data}
        parsed={parsed}
      />
    </div>
  );
}

function levelChipClass(level: 'info' | 'warn' | 'error'): string {
  if (level === 'error') return 'bg-destructive/10 text-destructive';
  if (level === 'warn') return 'bg-warning/10 text-warning';
  return 'bg-info/10 text-info';
}
