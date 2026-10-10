import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CloudDownload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { describeSimbriefError } from '@/lib/simbrief/fetchError';
import { isSimbriefUser } from '@/lib/simbrief/ofp';
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
  const fetchMutation = useSimbriefFetch({ track: false });

  const trimmed = localPilotId.trim();
  const hasChanges = trimmed !== simbrief.pilotId;
  const isValid = trimmed === '' || isSimbriefUser(trimmed);
  const isConfigured = !!simbrief.pilotId;

  const handleSave = () => {
    updateSimbriefSettings({ pilotId: trimmed });
  };

  const handleTest = () => {
    if (trimmed) {
      fetchMutation.mutate(trimmed);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={CloudDownload}
        iconClassName={cn('h-5 w-5', isConfigured ? 'text-primary' : 'text-muted-foreground')}
        title="SimBrief"
        description={t('settings.simbrief.description')}
      />

      {/* Pilot ID */}
      <SettingsSectionBlock
        title={t('settings.simbrief.pilotId')}
        description={t('settings.simbrief.pilotIdHelp')}
      >
        <div className="flex gap-2">
          <Input
            value={localPilotId}
            onChange={(e) => setLocalPilotId(e.target.value)}
            placeholder={t('settings.simbrief.pilotIdPlaceholder')}
            className="font-mono"
            maxLength={64}
            aria-invalid={!isValid}
          />
          <Button variant="outline" onClick={handleSave} disabled={!hasChanges || !isValid}>
            {t('common.save')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={!trimmed || !isValid || fetchMutation.isPending}
          >
            {fetchMutation.isPending && <Spinner className="" />}
            {fetchMutation.isSuccess && <Check className="text-success h-4 w-4" />}
            {fetchMutation.isError && <X className="text-destructive h-4 w-4" />}
            {t('common.test')}
          </Button>
        </div>

        {fetchMutation.isSuccess && (
          <div className="bg-success/10 text-success rounded-md p-3 text-sm">
            {t('settings.simbrief.testSuccessFull', {
              message: t('settings.simbrief.testSuccess'),
              origin: fetchMutation.data.origin.icao_code,
              destination: fetchMutation.data.destination.icao_code,
              aircraft: fetchMutation.data.aircraft.icao_code,
            })}
          </div>
        )}

        {fetchMutation.isError && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {describeSimbriefError(fetchMutation.error, t)}
          </div>
        )}

        <p className="text-muted-foreground text-sm">{t('settings.simbrief.pilotIdNote')}</p>
      </SettingsSectionBlock>

      {/* Help link */}
      <SettingsSectionBlock
        title={t('settings.simbrief.needAccount')}
        description={t('settings.simbrief.freeService')}
      >
        <SettingsLinkRow label={t('settings.simbrief.linkLabel')} href={SIMBRIEF_URL} />
      </SettingsSectionBlock>

      <FmsExportTargets />
    </div>
  );
}
