import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cruiseFitsTrack, trackFixString } from '@/lib/flightplan/builder/trackChoice';
import type {
  NatMessageStatus,
  OceanicTrackInfo,
  RouteIssue,
} from '@/lib/flightplan/builder/types';

export function TrackDetail({
  track,
  status,
  cruiseAltitudeFt,
  issues,
}: {
  track: OceanicTrackInfo;
  status: NatMessageStatus;
  cruiseAltitudeFt: number | null;
  issues: RouteIssue[];
}) {
  const { t } = useTranslation();
  const fits = cruiseFitsTrack(track, cruiseAltitudeFt);
  const warnings: string[] = [];
  if (!fits && cruiseAltitudeFt !== null) {
    // The levels on offer are listed just above, so the warning only names the cruise.
    warnings.push(
      t('planBuilder.tracks.levelWarning', { cruise: Math.round(cruiseAltitudeFt / 100) })
    );
  }
  if (issues.includes('trackPartial')) warnings.push(t('planBuilder.issues.trackPartial'));
  return (
    <div className="border-border/60 space-y-1.5 rounded-lg border p-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="xp-value font-semibold">
          {t('planBuilder.tracks.track', { id: track.id })}
        </span>
        {status === 'upcoming' && (
          <Badge variant="info" className="px-1.5 py-0">
            {t('planBuilder.tracks.upcoming')}
          </Badge>
        )}
        {status === 'expired' && (
          <Badge variant="outline" className="px-1.5 py-0">
            {t('planBuilder.tracks.lastPublished')}
          </Badge>
        )}
        {track.pbcs && (
          <Badge variant="outline" className="px-1.5 py-0">
            {t('planBuilder.tracks.pbcs')}
          </Badge>
        )}
        {track.levels.length > 0 && (
          <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
            {t('planBuilder.tracks.levelList', { levels: track.levels.join(' ') })}
          </span>
        )}
      </div>
      <p className="font-mono text-xs leading-5 break-words">{trackFixString(track)}</p>
      {(track.nars.length > 0 || track.feederFixes.length > 0) && (
        <p className="text-muted-foreground min-w-0 truncate font-mono text-xs">
          {[
            track.nars.length > 0 && t('planBuilder.tracks.nar', { list: track.nars.join(' ') }),
            track.feederFixes.length > 0 &&
              t('planBuilder.tracks.eurRts', { list: track.feederFixes.join(' ') }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-warning flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
}
