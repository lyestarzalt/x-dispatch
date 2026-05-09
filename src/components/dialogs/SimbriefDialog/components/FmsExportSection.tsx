import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useDownloadFmsFile } from '@/queries/useSimbriefQuery';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SimBriefOFP } from '@/types/simbrief';

interface FmsExportSectionProps {
  data: SimBriefOFP;
}

interface ResolvedTarget {
  id: string;
  label: string;
  folderPath: string;
  formatKey: string;
  url: string;
  filename: string;
}

function resolveTargets(data: SimBriefOFP): ResolvedTarget[] {
  const targets = useSettingsStore.getState().simbrief.fmsExportTargets;
  const downloads = data.fms_downloads as
    | (Record<string, { name: string; link: string } | undefined> & { directory?: string })
    | undefined;
  if (!downloads) return [];
  const directory = downloads.directory ?? '';

  return targets.flatMap((t) => {
    const file = downloads[t.formatKey];
    if (!file || typeof file !== 'object' || !file.link || !file.name) return [];
    return [
      {
        id: t.id,
        label: t.label,
        folderPath: t.folderPath,
        formatKey: t.formatKey,
        url: directory + file.link,
        filename: file.name,
      },
    ];
  });
}

export function FmsExportSection({ data }: FmsExportSectionProps) {
  const { t } = useTranslation();
  const targets = useSettingsStore((s) => s.simbrief.fmsExportTargets);
  const downloadMutation = useDownloadFmsFile();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  const resolved = resolveTargets(data);

  if (targets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t('simbrief.export.heading', 'Send to FMS')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              'simbrief.export.emptyHint',
              'No export targets configured. Add one in Settings → SimBrief.'
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (resolved.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t('simbrief.export.heading', 'Send to FMS')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              'simbrief.export.noMatches',
              'None of your configured formats are present in this SimBrief plan.'
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  const sendOne = async (entry: ResolvedTarget): Promise<boolean> => {
    setPendingId(entry.id);
    try {
      const result = await downloadMutation.mutateAsync({
        url: entry.url,
        targetDir: entry.folderPath,
        filename: entry.filename,
      });
      if (result.success) {
        toast.success(
          t('simbrief.export.success', 'Wrote {{filename}} to {{label}}', {
            filename: entry.filename,
            label: entry.label,
          })
        );
        return true;
      }
      toast.error(
        t('simbrief.export.failure', "Couldn't export {{label}}: {{reason}}", {
          label: entry.label,
          reason: result.error,
        })
      );
      return false;
    } finally {
      setPendingId(null);
    }
  };

  const sendAll = async () => {
    setBulkSending(true);
    let ok = 0;
    let fail = 0;
    for (const entry of resolved) {
      const success = await sendOne(entry);
      if (success) ok += 1;
      else fail += 1;
    }
    setBulkSending(false);
    toast.info(
      t('simbrief.export.bulkSummary', '{{ok}} of {{total}} sent', {
        ok,
        total: ok + fail,
      })
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">
          {t('simbrief.export.heading', 'Send to FMS')}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={sendAll} disabled={bulkSending}>
          {bulkSending && <Spinner className="mr-2" />}
          {t('simbrief.export.sendAll', 'Send all')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {resolved.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-md border border-border bg-popover/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{entry.label}</div>
                <div
                  className="truncate font-mono text-xs text-muted-foreground"
                  title={entry.folderPath}
                >
                  {entry.folderPath}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => sendOne(entry)}
                disabled={pendingId === entry.id || bulkSending}
              >
                {pendingId === entry.id ? (
                  <Spinner className="mr-2" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {t('simbrief.export.send', 'Send')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
