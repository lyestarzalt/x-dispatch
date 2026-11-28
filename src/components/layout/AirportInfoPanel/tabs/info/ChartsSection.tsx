import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type FaaChartGroup, groupFaaCharts } from '@/lib/parsers/nav/faaChartIndex';
import { cn } from '@/lib/utils/helpers';
import { useFaaAirportCharts } from '@/queries';
import { ChartControls } from './ChartControls';

/**
 * The FAA's charts for a US airport, grouped as a flight uses them. Each row opens the chart's
 * PDF in the browser; an FAA approach chart can also be laid over the map, since those PDFs carry
 * their map position. Renders nothing where the FAA lists no charts.
 */
export function ChartsSection({ icao }: { icao: string }) {
  const { t } = useTranslation();
  const { data } = useFaaAirportCharts(icao);
  const groups = useMemo(() => (data ? groupFaaCharts(data.charts) : []), [data]);
  // The airport diagram is what most pilots open first; the long lists wait for a click.
  const [open, setOpen] = useState<ReadonlySet<FaaChartGroup>>(new Set(['airport']));
  const toggle = (group: FaaChartGroup) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  if (!data || groups.length === 0) return null;

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h4 className="xp-section-heading mb-0 min-w-0 truncate border-b-0">
          {t('airportInfo.charts.title')}
        </h4>
        <span
          className={cn(
            'shrink-0 text-xs',
            data.expired ? 'text-warning' : 'text-muted-foreground'
          )}
          title={data.expired ? t('airportInfo.charts.expired') : undefined}
        >
          {t('airportInfo.charts.cycle', { cycle: data.cycle })}
        </span>
      </div>
      <div className="space-y-0.5">
        {groups.map(({ group, charts }) => {
          const expanded = open.has(group);
          return (
            <div key={group}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggle(group)}
                aria-expanded={expanded}
                className="text-muted-foreground hover:text-foreground h-7 w-full justify-start gap-1 px-1 text-xs"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
                <span className="min-w-0 truncate">{t(`airportInfo.charts.groups.${group}`)}</span>
                <span className="text-muted-foreground/60 ml-auto shrink-0 font-mono">
                  {charts.length}
                </span>
              </Button>
              {expanded && (
                <ul>
                  {charts.map((chart) => (
                    <li key={`${chart.url}-${chart.name}`} className="flex items-center">
                      <ChartControls chart={chart} icao={icao} group={group} showName />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground/70 text-2xs mt-1.5 px-1">
        {t('airportInfo.charts.simulationOnly')}
      </p>
    </section>
  );
}
