import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CloudDownload, ExternalLink, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import { useSimbriefFetch } from '@/queries/useSimbriefQuery';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SettingsSectionProps } from '../types';

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

      {/* Pilot ID Configuration */}
      <Card className={cn(isConfigured && 'border-primary/30')}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t('settings.simbrief.pilotId', 'Pilot ID')}
          </CardTitle>
          <CardDescription>
            {t(
              'settings.simbrief.pilotIdHelp',
              'Your SimBrief Pilot ID (found in your SimBrief account settings)'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              {fetchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {fetchMutation.isSuccess && <Check className="mr-2 h-4 w-4 text-success" />}
              {fetchMutation.isError && <X className="mr-2 h-4 w-4 text-destructive" />}
              {t('common.test', 'Test')}
            </Button>
          </div>

          {/* Test Result */}
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
        </CardContent>
      </Card>

      {/* Help Link */}
      <Card className="border-muted">
        <CardContent className="flex items-center justify-between pt-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t('settings.simbrief.needAccount', "Don't have a SimBrief account?")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('settings.simbrief.freeService', 'SimBrief is a free flight planning service')}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.simbrief.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              simbrief.com
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
