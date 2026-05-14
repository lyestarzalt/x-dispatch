import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CloudDownload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/helpers';
import { useSimbriefFetch } from '@/queries/useSimbriefQuery';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsLinkRow, SettingsSectionBlock } from '../primitives';
import type { SettingsSectionProps } from '../types';
import { FmsExportTargets } from './SimbriefSection/FmsExportTargets';

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
      <SettingsHeader
        icon={CloudDownload}
        iconClassName={cn('h-5 w-5', isConfigured ? 'text-primary' : 'text-muted-foreground')}
        title="SimBrief"
        description={t('settings.simbrief.description', 'Import flight plans from SimBrief')}
      />

      {/* Pilot ID */}
      <SettingsSectionBlock
        title={t('settings.simbrief.pilotId', 'Pilot ID')}
        description={t(
          'settings.simbrief.pilotIdHelp',
          'Your SimBrief Pilot ID (found in your SimBrief account settings)'
        )}
      >
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
      </SettingsSectionBlock>

      <Separator />

      {/* Help link */}
      <SettingsSectionBlock
        title={t('settings.simbrief.needAccount', "Don't have a SimBrief account?")}
        description={t(
          'settings.simbrief.freeService',
          'SimBrief is a free flight planning service'
        )}
      >
        <SettingsLinkRow label="simbrief.com" href={SIMBRIEF_URL} />
      </SettingsSectionBlock>

      <Separator />

      <FmsExportTargets />
    </div>
  );
}
