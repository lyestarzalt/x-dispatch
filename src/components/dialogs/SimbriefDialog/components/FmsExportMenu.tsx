import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FolderOutput, Send, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { fmsExportFilename } from '@/lib/simbrief/fmsFilename';
import { toastError } from '@/lib/utils/toastError';
import { useDownloadFmsFile } from '@/queries/useSimbriefQuery';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SimBriefOFP } from '@/types/simbrief';

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
    if (!file || typeof file !== 'object' || !file.link) return [];
    return [
      {
        id: t.id,
        label: t.label,
        folderPath: t.folderPath,
        formatKey: t.formatKey,
        url: directory + file.link,
        filename: fmsExportFilename(t.formatKey, data, file.link),
      },
    ];
  });
}

/**
 * "Send to FMS" as one footer button: each configured target is a menu entry, with
 * "Send all" when there are several. Without targets the menu leads to Settings.
 */
export function FmsExportMenu({
  data,
  onOpenSettings,
}: {
  data: SimBriefOFP;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const targets = useSettingsStore((s) => s.simbrief.fmsExportTargets);
  const downloadMutation = useDownloadFmsFile();
  const [busy, setBusy] = useState(false);

  const resolved = resolveTargets(data);

  const sendOne = async (entry: ResolvedTarget): Promise<boolean> => {
    const result = await downloadMutation.mutateAsync({
      url: entry.url,
      targetDir: entry.folderPath,
      filename: entry.filename,
      format: entry.formatKey,
    });
    if (result.success) {
      toast.success(t('simbrief.export.success', { filename: entry.filename, label: entry.label }));
      return true;
    }
    toastError(
      'fms_export',
      t('simbrief.export.failure', { label: entry.label, reason: result.error })
    );
    return false;
  };

  const run = async (entries: ResolvedTarget[]) => {
    setBusy(true);
    let ok = 0;
    try {
      for (const entry of entries) if (await sendOne(entry)) ok += 1;
    } finally {
      setBusy(false);
    }
    if (entries.length > 1)
      toast.info(t('simbrief.export.bulkSummary', { ok, total: entries.length }));
  };

  const openSettings = () => {
    onOpenSettings();
    useAppStore.getState().openSettings('simbrief');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy} className="gap-2">
          {busy ? <Spinner /> : <FolderOutput className="h-4 w-4" />}
          {t('simbriefDialog.actions.sendToFms')}
          <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {resolved.length === 0 && (
          <DropdownMenuLabel className="text-muted-foreground font-normal">
            {targets.length === 0
              ? t('simbriefDialog.actions.noTargets')
              : t('simbriefDialog.actions.noMatches')}
          </DropdownMenuLabel>
        )}
        {resolved.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            onClick={() => run([entry])}
            className="flex-col items-start gap-0"
          >
            <span className="flex items-center gap-2">
              <Send className="text-muted-foreground h-3.5 w-3.5" />
              {entry.label}
            </span>
            <span className="text-muted-foreground max-w-72 truncate pl-5.5 font-mono text-xs">
              {entry.folderPath}
            </span>
          </DropdownMenuItem>
        ))}
        {resolved.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => run(resolved)}>
              <Send className="text-muted-foreground mr-2 h-3.5 w-3.5" />
              {t('simbriefDialog.actions.sendAll')}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openSettings}>
          <Settings className="text-muted-foreground mr-2 h-3.5 w-3.5" />
          {t('simbriefDialog.actions.setupTargets')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
