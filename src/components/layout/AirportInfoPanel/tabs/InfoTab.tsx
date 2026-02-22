import { useMemo } from 'react';
import { Cloud, Gauge, Navigation, Thermometer, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNavDataQuery } from '@/queries';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { getATISForAirport, parseATISRunways, useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';

export default function InfoTab() {
  const airport = useAppStore((s) => s.selectedAirportData);
  const icao = useAppStore((s) => s.selectedICAO);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);

  const { data: vatsimMetarData } = useVatsimMetarQuery(icao);
  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: navData } = useNavDataQuery(
    airport?.runways[0]?.ends[0]?.latitude ?? null,
    airport?.runways[0]?.ends[0]?.longitude ?? null,
    50
  );

  const metar = vatsimMetarData?.decoded ?? null;
  const atis = useMemo(() => getATISForAirport(vatsimData, icao ?? ''), [vatsimData, icao]);
  const primaryAtis = atis[0];
  const atisRunways = primaryAtis ? parseATISRunways(primaryAtis) : [];

  if (!airport) return null;

  const ilsCount = navData?.ils.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Airport Identity */}
      <div>
        <p className="text-sm text-foreground/80">{airport.name}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>Elev {Math.round(airport.elevation)}'</span>
          {airport.metadata.transition_alt && <span>Trans {airport.metadata.transition_alt}'</span>}
          {airport.metadata.iata_code && airport.metadata.iata_code !== airport.id && (
            <span>IATA {airport.metadata.iata_code}</span>
          )}
        </div>
      </div>

      {/* ATIS - if available */}
      {primaryAtis && (
        <div className="rounded-lg bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                ATIS
              </span>
              <Badge variant="secondary" className="font-mono text-lg font-bold">
                {primaryAtis.atis_code || '?'}
              </Badge>
            </div>
            {atisRunways.length > 0 && (
              <span className="text-sm text-foreground">RWY {atisRunways.join(', ')}</span>
            )}
          </div>
        </div>
      )}

      {/* Weather */}
      {metar ? (
        <div className="space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Weather
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Wind */}
            <WeatherItem
              icon={<Wind className="h-4 w-4" />}
              label="Wind"
              value={formatWind(metar.wind)}
            />

            {/* Visibility */}
            <WeatherItem
              icon={<Navigation className="h-4 w-4" />}
              label="Visibility"
              value={formatVisibility(metar.visibility)}
            />

            {/* Ceiling */}
            <WeatherItem
              icon={<Cloud className="h-4 w-4" />}
              label="Ceiling"
              value={formatCeiling(metar.clouds)}
            />

            {/* Altimeter */}
            <WeatherItem
              icon={<Gauge className="h-4 w-4" />}
              label="QNH"
              value={formatAltimeter(metar.altimeter, metar.altimeterUnit)}
            />

            {/* Temperature */}
            <WeatherItem
              icon={<Thermometer className="h-4 w-4" />}
              label="Temp"
              value={metar.temperature !== null ? `${metar.temperature}°C` : '—'}
            />

            {/* Dewpoint */}
            <WeatherItem
              icon={<Thermometer className="h-4 w-4 opacity-50" />}
              label="Dewpoint"
              value={metar.dewpoint !== null ? `${metar.dewpoint}°C` : '—'}
            />
          </div>

          {/* Weather phenomena */}
          {metar.weather.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {metar.weather.map((wx, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {wx}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">No weather data available</p>
        </div>
      )}

      {/* Airport Stats */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Airport
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatItem label="Runways" value={airport.runways.length} />
          <StatItem label="Gates" value={airport.startupLocations?.length ?? 0} />
          {(airport.helipads?.length ?? 0) > 0 ? (
            <StatItem label="Helipads" value={airport.helipads.length} />
          ) : (
            <StatItem label="ILS" value={ilsCount} />
          )}
        </div>
      </div>

      {/* Raw METAR */}
      {vatsimMetarData?.raw && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Raw METAR
          </h3>
          <p className="font-mono text-xs leading-relaxed text-foreground/70">
            {vatsimMetarData.raw}
          </p>
        </div>
      )}
    </div>
  );
}

interface WeatherItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function WeatherItem({ icon, label, value }: WeatherItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: number;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-center">
      <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Formatting helpers
function formatWind(
  wind: { direction: number | 'VRB'; speed: number; gust?: number } | null
): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'Calm';

  const dir = wind.direction === 'VRB' ? 'VRB' : `${wind.direction}°`;
  const gust = wind.gust ? `G${wind.gust}` : '';
  return `${dir}/${wind.speed}${gust}kt`;
}

function formatVisibility(
  vis: { value: number; unit: 'SM' | 'M'; modifier?: 'M' | 'P' } | null
): string {
  if (!vis) return '—';

  const prefix = vis.modifier === 'M' ? '<' : vis.modifier === 'P' ? '>' : '';

  if (vis.unit === 'SM') {
    if (vis.value >= 10) return `${prefix}10+ SM`;
    return `${prefix}${vis.value} SM`;
  }

  if (vis.value >= 9999) return '>10 km';
  return `${prefix}${(vis.value / 1000).toFixed(1)} km`;
}

function formatCeiling(clouds: Array<{ cover: string; altitude?: number }>): string {
  // Find lowest BKN, OVC, or VV
  for (const cloud of clouds) {
    if (
      (cloud.cover === 'BKN' || cloud.cover === 'OVC' || cloud.cover === 'VV') &&
      cloud.altitude
    ) {
      return `${(cloud.altitude * 100).toLocaleString()}'`;
    }
  }

  // Check for clear conditions
  const hasClear = clouds.some((c) => ['CLR', 'SKC', 'NSC', 'NCD'].includes(c.cover));
  if (hasClear || clouds.length === 0) return 'Clear';

  // Has clouds but no ceiling
  return 'None';
}

function formatAltimeter(value: number | null, unit: 'inHg' | 'hPa'): string {
  if (value === null) return '—';
  if (unit === 'inHg') return `${value.toFixed(2)}"`;
  return `${value} hPa`;
}
