import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AirportGeorefInput } from '@/lib/sia/georef';
import { useVacChartQuery, useSiaInstallStatusQuery } from '@/queries/useSiaQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import type { ParsedAirport } from '@/types/apt';
import { VacChartPreview } from './VacChartPreview';

function buildGeorefInput(airport: ParsedAirport): AirportGeorefInput {
  const runways = airport.runways
    ?.map((r) => {
      const ends = r.ends ?? [];
      const e0 = ends[0];
      const e1 = ends[1] ?? ends[0];
      if (!e0 || !e1) return null;
      return {
        lat1: e0.latitude,
        lon1: e0.longitude,
        lat2: e1.latitude,
        lon2: e1.longitude,
        lengthM: 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { lat: airport.latitude, lon: airport.longitude, runways };
}

export default function VacTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const airport = useAppStore((s) => s.selectedAirportData);
  const selectedIcao = useAppStore((s) => s.selectedICAO);
  const icao = selectedIcao ?? airport?.id ?? null;
  const { data: status } = useSiaInstallStatusQuery();
  const georefInput = useMemo(
    () => (airport ? buildGeorefInput(airport) : null),
    [airport]
  );
  const { data: vacInfo, isLoading, isFetching, refetch } = useVacChartQuery(icao, georefInput);
  const reindexedRef = useRef(false);

  useEffect(() => {
    if (vacInfo || !status?.hasData || !icao || reindexedRef.current) return;
    reindexedRef.current = true;
    void (async () => {
      await window.siaAPI.reindexVac();
      void queryClient.invalidateQueries({ queryKey: ['sia'] });
      void refetch();
    })();
  }, [vacInfo, status?.hasData, icao, queryClient, refetch]);

  if (!status?.hasData) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>{t('vac.noData')}</p>
        <p className="text-xs">{t('sia.attribution')}</p>
      </div>
    );
  }

  if (isLoading || (isFetching && !vacInfo)) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!vacInfo || !icao) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t('vac.notFound')}</p>
        <p className="text-xs">{t('vac.notFoundHint')}</p>
        <p className="text-xs">{t('sia.attribution')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{t('vac.cycle', { cycle: vacInfo.cycle })}</span>
        {vacInfo.validFrom && vacInfo.validTo && (
          <span>
            {vacInfo.validFrom} → {vacInfo.validTo}
          </span>
        )}
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono uppercase">{vacInfo.chartType}</span>
      </div>

      <VacChartPreview icao={icao} chartIcao={vacInfo.icao} />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => void window.siaAPI.openVacPdf(icao)}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('vac.openExternal')}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" />
          {t('vac.print')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            void window.appAPI.openExternal(
              'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition/eaip.html'
            )
          }
        >
          <ExternalLink className="h-3.5 w-3.5" />
          SIA
        </Button>
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">{t('sia.attribution')}</p>
    </div>
  );
}
