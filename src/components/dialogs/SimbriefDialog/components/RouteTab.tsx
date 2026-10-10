import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { SimBriefOFP } from '@/types/simbrief';
import { NavlogTab } from './NavlogTab';
import { VerticalProfile } from './VerticalProfile';

/** The profile and the navlog are the same fixes: hovering the chart lights up the row. */
export function RouteTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const [hoverIdent, setHoverIdent] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="bg-card shrink-0 rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-foreground/80 min-w-0 truncate font-mono text-sm leading-relaxed">
            {data.general.route}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {data.general.sid_ident && (
              <Badge variant="secondary" className="text-2xs">
                {t('simbriefDialog.route.sid', { id: data.general.sid_ident })}
              </Badge>
            )}
            {data.general.star_ident && (
              <Badge variant="secondary" className="text-2xs">
                {t('simbriefDialog.route.star', { id: data.general.star_ident })}
              </Badge>
            )}
            <Badge variant="outline" className="text-2xs">
              {t('simbriefDialog.route.fixesCount', { count: data.navlog.length })}
            </Badge>
          </div>
        </div>
        <VerticalProfile
          data={data}
          className="h-48"
          onHover={(row) => setHoverIdent(row?.ident ?? null)}
        />
      </div>

      <NavlogTab data={data} apiUnit={apiUnit} highlightIdent={hoverIdent} />
    </div>
  );
}
