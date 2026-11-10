import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { routeForClipboard } from '@/lib/flightplan/builder/routeTokens';
import type { SimBriefOFP } from '@/types/simbrief';
import { NavlogTab } from './NavlogTab';
import { VerticalProfile } from './VerticalProfile';

/** The profile and the navlog are the same fixes: hovering the chart lights up the row. */
export function RouteTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const { t } = useTranslation();
  const [hoverIdent, setHoverIdent] = useState<string | null>(null);
  // The general route carries the SID and STAR; the airports and runways go around it.
  const route = routeForClipboard(
    data.general.route,
    { icao: data.origin.icao_code, runway: data.origin.plan_rwy },
    { icao: data.destination.icao_code, runway: data.destination.plan_rwy }
  );

  // Chart apps and EFBs take the route pasted in; a long oceanic route did not fit one line.
  const copyRoute = async () => {
    if (!route) return;
    await window.appAPI.clipboardWrite(route);
    toast.success(t('common.copiedToClipboard'));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="bg-card shrink-0 rounded-lg border p-4">
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="text-foreground/80 max-h-24 min-w-0 flex-1 overflow-y-auto font-mono text-sm leading-relaxed break-words select-text">
            {route}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="xs" onClick={copyRoute} disabled={!route}>
              <Copy className="h-3.5 w-3.5" />
              {t('simbriefDialog.route.copy')}
            </Button>
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
