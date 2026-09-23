import { renderToStaticMarkup } from 'react-dom/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { buildAirportAtcRows } from '@/lib/vatsimSectors/airportAtc';
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { VatsimATIS, VatsimController } from '@/types/vatsim';

type AirportController = VatsimController | VatsimATIS;

function VatsimAirportAtcPopup({
  airport,
  controllers,
}: {
  airport: Airport;
  controllers: AirportController[];
}) {
  const rows = buildAirportAtcRows(
    controllers.filter(
      (controller): controller is VatsimController => !('atis_code' in controller)
    ),
    controllers.filter((controller): controller is VatsimATIS => 'atis_code' in controller)
  );

  return (
    <Card className="border-border/50 bg-card/95 w-[360px] overflow-hidden shadow-2xl">
      <CardHeader className="border-border/40 bg-background/60 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-info font-mono text-sm font-bold">{airport.icao}</div>
            <div className="text-foreground truncate text-sm">{airport.name}</div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            {controllers.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="max-h-[320px] space-y-2 overflow-y-auto p-3">
        {rows.map((row) => (
          <div key={row.id} className="border-border/40 bg-background/70 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={row.badgeVariant}
                    className="px-1.5 py-0 font-mono text-[10px] font-semibold uppercase"
                  >
                    {row.badgeLabel}
                  </Badge>
                  <span className="text-foreground min-w-0 truncate font-mono text-sm font-semibold">
                    {row.callsign}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 truncate text-sm">{row.summary}</div>
              </div>
              <Badge variant="info" className="font-mono text-xs">
                {row.frequency}
              </Badge>
            </div>
            {row.detail && (
              <div className="border-border/30 bg-card/80 text-muted-foreground mt-2 rounded-md border px-2.5 py-2 font-mono text-xs">
                {row.detail}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function renderVatsimAirportAtcPopup(
  airport: Airport,
  controllers: AirportController[]
): string {
  return renderToStaticMarkup(
    <VatsimAirportAtcPopup airport={airport} controllers={controllers} />
  );
}
