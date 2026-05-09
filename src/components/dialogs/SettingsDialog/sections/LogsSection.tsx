import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCcw, ScrollText, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
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

  const Header = (
    <>
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <ScrollText className="h-5 w-5" />
          {t('settings.logs.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('settings.logs.description')}</p>
      </div>
      <Separator />
    </>
  );

  const Toolbar = ({ canReport }: { canReport: boolean }) => (
    <div className="flex items-center gap-2">
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
        {Header}
        <Toolbar canReport={false} />
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  const result = query.data;

  if (result.kind === 'no-path') {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar canReport={false} />
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('settings.logs.empty.noPath')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.kind === 'no-log') {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar canReport={false} />
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('settings.logs.empty.noLog')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.kind === 'error') {
    return (
      <div className="space-y-6">
        {Header}
        <Toolbar canReport={false} />
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-6">
            <p className="font-mono text-xs text-destructive">{result.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const parsed: ParseResult = parseLog(result.data);
  const isAllClear = parsed.recognized.length === 0 && parsed.otherIssues.length === 0;

  return (
    <div className="space-y-6">
      {Header}

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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="h-4 w-4" />
              {t('settings.logs.recognizedIssuesHeader', { count: parsed.recognized.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {parsed.recognized.map((m) => (
                <li
                  key={`${m.lineNumber}-${m.id}`}
                  className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3"
                >
                  <Badge className={levelChipClass(m.level)}>{m.level}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{t(`logs.patterns.${m.id}`)}</p>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {t('settings.logs.lineNumber', { line: m.lineNumber })} · {m.line}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {parsed.otherIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              {t('settings.logs.otherIssuesHeader', { count: parsed.otherIssues.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {parsed.otherIssues.map((m) => (
                <li
                  key={`${m.lineNumber}-${m.category}`}
                  className="flex items-start gap-3 rounded-md border border-border bg-muted/10 p-3"
                >
                  <Badge className={levelChipClass(m.level)}>{m.level}</Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    {m.category}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                    {t('settings.logs.lineNumber', { line: m.lineNumber })} · {m.line}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isAllClear && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">{t('settings.logs.empty.allClear')}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <Collapsible open={showRaw} onOpenChange={setShowRaw}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="-mx-2 justify-start px-2">
                <ScrollText className="mr-2 h-4 w-4" />
                {showRaw ? t('settings.logs.hideFullLog') : t('settings.logs.showFullLog')}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/10 p-3 font-mono text-xs text-muted-foreground">
                {result.data}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

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
