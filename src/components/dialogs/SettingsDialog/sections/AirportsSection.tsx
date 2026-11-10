import { useTranslation } from 'react-i18next';
import { Home, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useFavoriteAirports } from '@/hooks/useFavoriteAirports';
import { cn } from '@/lib/utils/helpers';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  SettingsEmptyState,
  SettingsHeader,
  SettingsSectionBlock,
  SettingsToggleRow,
} from '../primitives';
import type { SettingsSectionProps } from '../types';

export default function AirportsSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { favoriteIcaos, autoNavigateHomeOnStart } = useSettingsStore((s) => s.airports);
  const updateAirportsSettings = useSettingsStore((s) => s.updateAirportsSettings);
  const removeFavoriteAirport = useSettingsStore((s) => s.removeFavoriteAirport);
  const setHomeAirport = useSettingsStore((s) => s.setHomeAirport);
  const requestSelectAirport = useAppStore((s) => s.requestSelectAirport);
  const rows = useFavoriteAirports();

  return (
    <div className={cn('space-y-6', className)}>
      <SettingsHeader
        icon={Star}
        title={t('settings.airports.title')}
        description={t('settings.airports.description')}
      />

      {/* Startup behavior */}
      <SettingsSectionBlock title={t('settings.airports.startup')}>
        <SettingsToggleRow
          title={t('settings.airports.autoNav.label')}
          description={t('settings.airports.autoNav.description')}
          checked={autoNavigateHomeOnStart}
          onCheckedChange={(checked) =>
            updateAirportsSettings({ autoNavigateHomeOnStart: checked })
          }
        />
      </SettingsSectionBlock>

      <Separator />

      {/* Favorites + home list */}
      <SettingsSectionBlock
        title={t('settings.airports.favorites.title')}
        description={t('settings.airports.favorites.description')}
      >
        {rows.length === 0 ? (
          <SettingsEmptyState message={t('settings.airports.favorites.empty')} />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.icao} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => requestSelectAirport(row.icao)}
                    className="flex min-w-0 flex-1 items-baseline gap-3 text-left hover:opacity-80"
                  >
                    <span className="text-info font-mono text-sm font-bold">{row.icao}</span>
                    <span className="text-muted-foreground min-w-0 truncate text-sm">
                      {row.name ?? t('settings.airports.favorites.notInAirac')}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground/60 hover:text-foreground h-8 w-8"
                      onClick={() => setHomeAirport(row.isHome ? null : row.icao)}
                      tooltip={
                        row.isHome
                          ? t('settings.airports.actions.clearHome')
                          : t('settings.airports.actions.setHome')
                      }
                    >
                      <Home className={cn('h-4 w-4', row.isHome && 'text-primary fill-current')} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                      onClick={() => {
                        // For a home-only row (home set but not in favorites), the trash
                        // button clears the home flag instead of removing a non-existent
                        // favorite entry.
                        if (row.isHome && !favoriteIcaos.includes(row.icao)) {
                          setHomeAirport(null);
                        } else {
                          removeFavoriteAirport(row.icao);
                        }
                      }}
                      tooltip={t('settings.airports.actions.remove')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSectionBlock>
    </div>
  );
}
