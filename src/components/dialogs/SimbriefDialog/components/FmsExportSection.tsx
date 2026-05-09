import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOutput, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOutput className="h-4 w-4" />
        <span className="font-medium text-foreground">
          {t('simbrief.export.heading', 'Send to FMS')}
        </span>
        <span>·</span>
        <span>
          {t(
            'simbrief.export.emptyHint',
            'No export targets configured. Add one in Settings → SimBrief.'
          )}
        </span>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOutput className="h-4 w-4" />
        <span className="font-medium text-foreground">
          {t('simbrief.export.heading', 'Send to FMS')}
        </span>
        <span>·</span>
        <span>
          {t(
            'simbrief.export.noMatches',
            'None of your configured formats are present in this SimBrief plan.'
          )}
        </span>
      </div>
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FolderOutput className="h-4 w-4 text-muted-foreground" />
          {t('simbrief.export.heading', 'Send to FMS')}
        </div>
        {resolved.length > 1 && (
          <Button size="sm" variant="outline" onClick={sendAll} disabled={bulkSending}>
            {bulkSending && <Spinner className="mr-2" />}
            {t('simbrief.export.sendAll', 'Send all')}
          </Button>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {resolved.map((entry) => (
          <li key={entry.id}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendOne(entry)}
              disabled={pendingId === entry.id || bulkSending}
              tooltip={entry.folderPath}
              className="gap-2"
            >
              {pendingId === entry.id ? (
                <Spinner />
              ) : (
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="font-medium">{entry.label}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
