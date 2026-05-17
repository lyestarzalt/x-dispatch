import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import { useAirportsListQuery } from '@/queries/useAirportsListQuery';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  SettingsEmptyState,
  SettingsHeader,
  SettingsSectionBlock,
  SettingsToggleRow,
} from '../primitives';
import type { SettingsSectionProps } from '../types';

interface ResolvedFavorite {
  icao: string;
  name: string | null;
  isHome: boolean;
}

export default function AirportsSection({ className }: SettingsSectionProps) {
  const { t } = useTranslation();
  const { favoriteIcaos, homeIcao, autoNavigateHomeOnStart } = useSettingsStore((s) => s.airports);
  const updateAirportsSettings = useSettingsStore((s) => s.updateAirportsSettings);
  const removeFavoriteAirport = useSettingsStore((s) => s.removeFavoriteAirport);
  const setHomeAirport = useSettingsStore((s) => s.setHomeAirport);
  const requestSelectAirport = useAppStore((s) => s.requestSelectAirport);
  const { data: airports } = useAirportsListQuery();

  // Union of favorites + home (home may not be in favorites — independent fields).
  // Home is shown first so the user always sees their primary airport at the top.
  const rows = useMemo<ResolvedFavorite[]>(() => {
    const nameByIcao = new Map(airports?.map((a) => [a.icao, a.name]) ?? []);
    const ordered: string[] = [];
    if (homeIcao && !favoriteIcaos.includes(homeIcao)) ordered.push(homeIcao);
    for (const icao of favoriteIcaos) ordered.push(icao);
    return ordered.map((icao) => ({
      icao,
      name: nameByIcao.get(icao) ?? null,
      isHome: icao === homeIcao,
    }));
  }, [airports, favoriteIcaos, homeIcao]);

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
                    <span className="font-mono text-sm font-bold text-info">{row.icao}</span>
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {row.name ?? t('settings.airports.favorites.notInAirac')}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
                      onClick={() => setHomeAirport(row.isHome ? null : row.icao)}
                      tooltip={
                        row.isHome
                          ? t('settings.airports.actions.clearHome')
                          : t('settings.airports.actions.setHome')
                      }
                    >
                      <Home className={cn('h-4 w-4', row.isHome && 'fill-current text-primary')} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
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
