import { useTranslation } from 'react-i18next';
import { FolderOpen, PlaneLanding } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SettingsHeader, SettingsSectionBlock, SettingsToggleRow } from '../primitives';

export function FlightsSection() {
  const { t } = useTranslation();
  const flights = useSettingsStore((s) => s.flights);
  const updateFlights = useSettingsStore((s) => s.updateFlightsSettings);
  const trailEnabled = useMapStore((s) => s.flightTrailEnabled);
  const setTrailEnabled = useMapStore((s) => s.setFlightTrailEnabled);

  return (
    <div className="space-y-6">
      <SettingsHeader
        icon={PlaneLanding}
        title={t('settings.flights.title')}
        description={t('settings.flights.description')}
      />

      <SettingsSectionBlock title={t('settings.flights.recordingSection')}>
        <SettingsToggleRow
          title={t('settings.flights.recording')}
          description={t('settings.flights.recordingDesc')}
          checked={flights.recording}
          onCheckedChange={(checked) => updateFlights({ recording: checked })}
        />
        <SettingsToggleRow
          title={t('settings.flights.trail')}
          description={t('settings.flights.trailDesc')}
          checked={trailEnabled}
          onCheckedChange={setTrailEnabled}
        />
      </SettingsSectionBlock>

      <SettingsSectionBlock title={t('settings.flights.landingSection')}>
        <SettingsToggleRow
          title={t('settings.flights.landingReport')}
          description={t('settings.flights.landingReportDesc')}
          checked={flights.landingReport}
          onCheckedChange={(checked) => updateFlights({ landingReport: checked })}
        />
        <SettingsToggleRow
          title={t('settings.flights.landingFlyTo')}
          description={t('settings.flights.landingFlyToDesc')}
          checked={flights.landingFlyTo}
          disabled={!flights.landingReport}
          onCheckedChange={(checked) => updateFlights({ landingFlyTo: checked })}
        />
        <p className="px-3 pt-1 text-xs text-muted-foreground">{t('settings.flights.credit')}</p>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title={t('settings.flights.storage')}
        description={t('settings.flights.storageDesc')}
      >
        <Button
          variant="ghost"
          onClick={() => void window.flightsAPI.openFolder()}
          className="h-auto w-full justify-start gap-2 px-3 py-2 text-sm hover:bg-secondary"
        >
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {t('settings.flights.openFolder')}
        </Button>
      </SettingsSectionBlock>
    </div>
  );
}
