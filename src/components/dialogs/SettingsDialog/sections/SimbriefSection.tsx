import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CloudDownload, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/helpers';
import { useSimbriefFetch } from '@/queries/useSimbriefQuery';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SettingsSectionProps } from '../types';
import { FmsExportTargets } from './SimbriefSection/FmsExportTargets';
import { openSettingsExternalLink } from './externalLinks';

const SIMBRIEF_URL = 'https://www.simbrief.com';

export default function SimbriefSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { simbrief, updateSimbriefSettings } = useSettingsStore();
  const [localPilotId, setLocalPilotId] = useState(simbrief.pilotId);
  const fetchMutation = useSimbriefFetch();

  const hasChanges = localPilotId !== simbrief.pilotId;
  const isConfigured = !!simbrief.pilotId;

  const handleSave = () => {
    updateSimbriefSettings({ pilotId: localPilotId });
  };

  const handleTest = () => {
    if (localPilotId) {
      fetchMutation.mutate(localPilotId);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <CloudDownload
            className={cn('h-5 w-5', isConfigured ? 'text-primary' : 'text-muted-foreground')}
          />
          SimBrief
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.simbrief.description', 'Import flight plans from SimBrief')}
        </p>
      </div>

      <Separator />

      {/* Pilot ID */}
      <div className="space-y-3">
        <div>
          <h3 className="xp-section-heading">{t('settings.simbrief.pilotId', 'Pilot ID')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'settings.simbrief.pilotIdHelp',
              'Your SimBrief Pilot ID (found in your SimBrief account settings)'
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={localPilotId}
            onChange={(e) => setLocalPilotId(e.target.value.replace(/\D/g, ''))}
            placeholder="1234567"
            className="font-mono"
            maxLength={10}
          />
          <Button variant="outline" onClick={handleSave} disabled={!hasChanges}>
            {t('common.save', 'Save')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={!localPilotId || fetchMutation.isPending}
          >
            {fetchMutation.isPending && <Spinner className="mr-2" />}
            {fetchMutation.isSuccess && <Check className="mr-2 h-4 w-4 text-success" />}
            {fetchMutation.isError && <X className="mr-2 h-4 w-4 text-destructive" />}
            {t('common.test', 'Test')}
          </Button>
        </div>

        {fetchMutation.isSuccess && (
          <div className="rounded-md bg-success/10 p-3 text-sm text-success">
            {t('settings.simbrief.testSuccess', 'Found flight plan')}:{' '}
            {fetchMutation.data.origin.icao_code} → {fetchMutation.data.destination.icao_code}
            <span className="ml-2 text-sm opacity-80">
              ({fetchMutation.data.aircraft.icao_code})
            </span>
          </div>
        )}

        {fetchMutation.isError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {fetchMutation.error.message}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {t(
            'settings.simbrief.pilotIdNote',
            'Your Pilot ID is a numeric identifier. Find it at simbrief.com → Account Settings → Pilot ID.'
          )}
        </p>
      </div>

      <Separator />

      {/* Help link */}
      <div className="space-y-3">
        <h3 className="xp-section-heading">
          {t('settings.simbrief.needAccount', "Don't have a SimBrief account?")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.simbrief.freeService', 'SimBrief is a free flight planning service')}
        </p>
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => void openSettingsExternalLink(SIMBRIEF_URL)}
            className="h-auto w-full justify-between gap-3 px-3 py-2 text-sm hover:bg-secondary"
          >
            <span className="min-w-0 truncate">simbrief.com</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <Separator />

      <FmsExportTargets />
    </div>
  );
}
