import { useTranslation } from 'react-i18next';
import type { SceneryConflicts } from '@/lib/addonManager/scenery/conflicts';

interface SceneryConflictListProps {
  folderName: string;
  conflicts: SceneryConflicts;
}

/** What a pack shares with other packs, and which one X-Plane actually uses. */
export function SceneryConflictList({ folderName, conflicts }: SceneryConflictListProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="xp-section-heading">{t('addonManager.scenery.conflicts.title')}</p>
      <ul className="space-y-1.5 text-xs">
        {conflicts.duplicateAirports.map((dup) => (
          <li key={`apt-${dup.icao}`} className="min-w-0">
            <span className="text-foreground font-mono font-semibold">{dup.icao}</span>{' '}
            <span className="text-muted-foreground">
              {dup.winner === null
                ? t('addonManager.scenery.conflicts.airportAllOff', {
                    packs: dup.others.join(', '),
                  })
                : dup.winner === folderName
                  ? t('addonManager.scenery.conflicts.airportThisWins', {
                      packs: dup.others.join(', '),
                    })
                  : t('addonManager.scenery.conflicts.airportOtherWins', { pack: dup.winner })}
            </span>
          </li>
        ))}
        {conflicts.duplicateTiles.map((dup) => (
          <li key={`tile-${dup.tile}`} className="min-w-0">
            <span className="text-foreground font-mono font-semibold">{dup.tile}</span>{' '}
            <span className="text-muted-foreground">
              {t('addonManager.scenery.conflicts.tile', { packs: dup.others.join(', ') })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
