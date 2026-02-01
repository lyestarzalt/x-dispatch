import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  Clock,
  MapPin,
  Plane,
  Radio,
  Rocket,
  Route,
  Search,
  Wind,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ParsedAirport } from '@/lib/aptParser';
import { FrequencyType, Runway } from '@/lib/aptParser/types';
import { cn } from '@/lib/utils';
import { FeatureDebugInfo } from '@/stores/mapStore';
import { NamedPosition, Position } from '@/types/geo';
import { WeatherData } from '@/types/weather';
import ProceduresContent, { Procedure } from './tabs/ProceduresTab';

export type { FeatureDebugInfo };

export interface SidebarProps {
  airport: ParsedAirport | null;
  onCloseAirport: () => void;
  weather: WeatherData;
  gatewayInfo?: unknown;
  onRefreshGateway?: () => void;
  layerVisibility: unknown;
  onLayerToggle: (layer: string) => void;
  navVisibility: unknown;
  onNavToggle: (layer: string) => void;
  onLoadViewportNavaids: () => void;
  isLoadingNav: boolean;
  navDataCounts: {
    vors: number;
    ndbs: number;
    dmes: number;
    ils: number;
    waypoints: number;
    airspaces: number;
    highAirways: number;
    lowAirways: number;
  };
  onNavigateToGate?: (gate: Position & { heading: number }) => void;
  onSelectRunway?: (runway: Runway) => void;
  debugEnabled?: boolean;
  onDebugToggle?: () => void;
  selectedFeature?: FeatureDebugInfo | null;
  onClearSelectedFeature?: () => void;
  onSelectProcedure?: (procedure: Procedure) => void;
  selectedProcedure?: Procedure | null;
  onSelectGateAsStart?: (gate: NamedPosition) => void;
  onSelectRunwayEndAsStart?: (runwayEnd: NamedPosition) => void;
  selectedStartPosition?: { type: 'runway' | 'ramp'; name: string } | null;
}

export default function Sidebar({
  airport,
  onCloseAirport,
  weather,
  navDataCounts,
  onSelectRunway,
  onSelectProcedure,
  selectedProcedure,
  onSelectGateAsStart,
  onSelectRunwayEndAsStart,
  selectedStartPosition,
}: SidebarProps) {
  const { t } = useTranslation();
  const [gateSearch, setGateSearch] = useState('');

  const filteredGates = useMemo(() => {
    if (!airport?.startupLocations) return [];
    if (!gateSearch) return airport.startupLocations;
    const q = gateSearch.toLowerCase();
    return airport.startupLocations.filter((g) => g.name.toLowerCase().includes(q));
  }, [airport?.startupLocations, gateSearch]);

  const freqGroups = useMemo(() => {
    if (!airport?.frequencies)
      return { TWR: [], GND: [], DEL: [], APP: [], ATIS: [], CTR: [], CTAF: [], UNICOM: [] };
    return {
      TWR: airport.frequencies.filter((f) => f.type === FrequencyType.TOWER),
      GND: airport.frequencies.filter((f) => f.type === FrequencyType.GROUND),
      DEL: airport.frequencies.filter((f) => f.type === FrequencyType.DELIVERY),
      APP: airport.frequencies.filter((f) => f.type === FrequencyType.APPROACH),
      ATIS: airport.frequencies.filter((f) => f.type === FrequencyType.AWOS),
      CTR: airport.frequencies.filter((f) => f.type === FrequencyType.CENTER),
      CTAF: airport.frequencies.filter((f) => f.type === FrequencyType.CTAF),
      UNICOM: airport.frequencies.filter((f) => f.type === FrequencyType.UNICOM),
    };
  }, [airport?.frequencies]);

  if (!airport) return null;

  const metar = weather.metar?.decoded;

  const rwy = airport.runways[0];
  const lat = rwy ? (rwy.ends[0].latitude + rwy.ends[1].latitude) / 2 : 0;
  const lon = rwy ? (rwy.ends[0].longitude + rwy.ends[1].longitude) / 2 : 0;

  const tzOffset = Math.round(lon / 15);
  const localTime = new Date();
  localTime.setHours(localTime.getUTCHours() + tzOffset);
  const timeStr = localTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const tzStr = tzOffset >= 0 ? `UTC+${tzOffset}` : `UTC${tzOffset}`;

  return (
    <div className="absolute bottom-4 right-4 top-20 z-20 w-80">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-sm">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-blue-400" />
                <h2 className="font-mono text-xl font-bold text-foreground">{airport.id}</h2>
                <FlightCategoryBadge category={metar?.flightCategory || '--'} />
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{airport.name}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseAirport}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Airport Info */}
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>
                {airport.metadata.city || '--'}, {airport.metadata.country || '--'}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="opacity-60">ELEV</span>
                <span className="font-mono text-foreground">{Math.round(airport.elevation)}'</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span className="font-mono text-foreground">{timeStr}</span>
                <span className="opacity-60">{tzStr}</span>
              </div>
            </div>
          </div>

          {/* Selected Start Position */}
          {selectedStartPosition && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-2">
              <Rocket className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-green-400">{t('launcher.config.departure')}:</span>
              <span className="truncate text-xs font-medium text-foreground">
                {selectedStartPosition.name}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="weather" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-3 mt-2 grid h-8 grid-cols-4 bg-muted/50">
            <TabsTrigger value="weather" className="text-[10px] data-[state=active]:bg-muted">
              <Wind className="mr-1 h-3 w-3" />
              WX
            </TabsTrigger>
            <TabsTrigger value="ground" className="text-[10px] data-[state=active]:bg-muted">
              <Plane className="mr-1 h-3 w-3 rotate-45" />
              GND
            </TabsTrigger>
            <TabsTrigger value="procedures" className="text-[10px] data-[state=active]:bg-muted">
              <Route className="mr-1 h-3 w-3" />
              NAV
            </TabsTrigger>
            <TabsTrigger value="radio" className="text-[10px] data-[state=active]:bg-muted">
              <Radio className="mr-1 h-3 w-3" />
              COM
            </TabsTrigger>
          </TabsList>

          {/* Weather Tab */}
          <TabsContent value="weather" className="m-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-3 p-3">
                {weather.metar?.raw ? (
                  <>
                    {/* Decoded Weather */}
                    <div className="grid grid-cols-2 gap-2">
                      <WeatherCard label={t('sidebar.wind')} value={formatWind(metar)} />
                      <WeatherCard
                        label={t('sidebar.visibility')}
                        value={formatVisibility(metar)}
                      />
                      <WeatherCard label={t('sidebar.ceiling')} value={formatCeiling(metar)} />
                      <WeatherCard
                        label={t('sidebar.altimeter')}
                        value={metar?.altimeter ? `${metar.altimeter.toFixed(2)}"` : '--'}
                      />
                      {metar?.temperature !== undefined && (
                        <WeatherCard label={t('sidebar.temp')} value={`${metar.temperature}°C`} />
                      )}
                      {metar?.dewpoint !== undefined && (
                        <WeatherCard label={t('sidebar.dewpoint')} value={`${metar.dewpoint}°C`} />
                      )}
                    </div>

                    {/* Clouds */}
                    {metar?.clouds && metar.clouds.length > 0 && (
                      <div className="rounded-lg bg-muted/50 p-2">
                        <p className="mb-1 text-[10px] text-muted-foreground">
                          {t('sidebar.clouds')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {metar.clouds.map(
                            (c: { cover: string; altitude?: number }, i: number) => (
                              <span
                                key={i}
                                className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                              >
                                {c.cover} {c.altitude ? `${c.altitude * 100}'` : ''}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Raw METAR */}
                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <p className="mb-1 text-[10px] text-muted-foreground">METAR</p>
                      <p className="break-all font-mono text-[11px] leading-relaxed text-foreground/80">
                        {weather.metar.raw}
                      </p>
                    </div>

                    {/* TAF if available */}
                    {weather.taf && (
                      <div className="rounded-lg bg-muted/50 p-2.5">
                        <p className="mb-1 text-[10px] text-muted-foreground">TAF</p>
                        <p className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {weather.taf}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('sidebar.noWeatherData')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Ground Tab - Runways & Gates */}
          <TabsContent value="ground" className="m-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-3">
                {/* Runways */}
                <div>
                  <h4 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t('sidebar.runways')} ({airport.runways.length})
                  </h4>
                  <div className="space-y-2">
                    {airport.runways.map((rwy, i) => (
                      <RunwayCard
                        key={i}
                        runway={rwy}
                        onClick={() => onSelectRunway?.(rwy)}
                        onSelectEnd={(end) => onSelectRunwayEndAsStart?.(end)}
                        selectedEndName={
                          selectedStartPosition?.type === 'runway'
                            ? selectedStartPosition.name
                            : undefined
                        }
                        ilsCount={navDataCounts.ils}
                      />
                    ))}
                  </div>
                </div>

                {/* Gates/Parking */}
                {airport.startupLocations && airport.startupLocations.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t('sidebar.gatesParking')} ({airport.startupLocations.length})
                    </h4>
                    <div className="relative mb-2">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        placeholder={t('sidebar.searchGates')}
                        value={gateSearch}
                        onChange={(e) => setGateSearch(e.target.value)}
                        className="h-7 border-border bg-muted/50 pl-7 text-xs"
                      />
                    </div>
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {filteredGates.slice(0, 30).map((gate, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          onClick={() =>
                            onSelectGateAsStart?.({
                              latitude: gate.latitude,
                              longitude: gate.longitude,
                              name: gate.name,
                            })
                          }
                          className={cn(
                            'flex h-auto w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs',
                            selectedStartPosition?.type === 'ramp' &&
                              selectedStartPosition.name === gate.name
                              ? 'border border-green-500/30 bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <span className="truncate font-mono">{gate.name}</span>
                          <span className="text-[10px] text-muted-foreground/50">
                            {Math.round(gate.heading)}°
                          </span>
                        </Button>
                      ))}
                      {filteredGates.length > 30 && (
                        <p className="pt-1 text-center text-[10px] text-muted-foreground/50">
                          +{filteredGates.length - 30} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Procedures Tab - SIDs, STARs, Approaches */}
          <TabsContent value="procedures" className="m-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3">
                <ProceduresContent
                  icao={airport.id}
                  onSelectProcedure={onSelectProcedure || (() => {})}
                  selectedProcedure={selectedProcedure || null}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Radio Tab - Frequencies */}
          <TabsContent value="radio" className="m-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-3 p-3">
                {airport.frequencies.length > 0 ? (
                  Object.entries(freqGroups).map(
                    ([type, freqs]) =>
                      freqs.length > 0 && (
                        <div key={type}>
                          <h4 className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            {type}
                          </h4>
                          <div className="space-y-1">
                            {freqs.map((freq, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded bg-muted/50 p-2"
                              >
                                <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                                  {freq.name}
                                </span>
                                <span className="font-mono text-sm text-foreground">
                                  {freq.frequency.toFixed(3)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                  )
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('sidebar.noFrequencies')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper Components

function FlightCategoryBadge({ category }: { category: string }) {
  const getVariant = () => {
    switch (category) {
      case 'VFR':
        return 'success';
      case 'MVFR':
        return 'info';
      case 'IFR':
        return 'danger';
      case 'LIFR':
        return 'purple';
      default:
        return 'secondary';
    }
  };

  return (
    <Badge
      variant={getVariant() as 'success' | 'info' | 'danger' | 'purple' | 'secondary'}
      className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
    >
      {category}
    </Badge>
  );
}

function WeatherCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function formatWind(metar: any): string {
  if (!metar?.wind) return '--';
  const dir = metar.wind.direction ?? '--';
  const spd = metar.wind.speed ?? '--';
  const gust = metar.wind.gust;
  return gust ? `${dir}°/${spd}G${gust}kt` : `${dir}°/${spd}kt`;
}

function formatVisibility(metar: any): string {
  if (!metar?.visibility) return '--';
  const val = metar.visibility.value ?? '--';
  const unit = metar.visibility.unit === 'SM' ? 'SM' : 'm';
  return `${val} ${unit}`;
}

function formatCeiling(metar: any): string {
  if (!metar?.clouds) return '--';
  const ceiling = metar.clouds.find(
    (c: { cover?: string }) => c.cover === 'BKN' || c.cover === 'OVC'
  );
  if (!ceiling?.altitude) return 'CLR';
  return `${ceiling.altitude * 100}'`;
}

interface RunwayCardProps {
  runway: Runway;
  onClick?: () => void;
  onSelectEnd?: (end: NamedPosition) => void;
  selectedEndName?: string;
  ilsCount?: number;
}

function RunwayCard({ runway, onClick, onSelectEnd, selectedEndName, ilsCount }: RunwayCardProps) {
  const { t } = useTranslation();
  const e1 = runway.ends[0];
  const e2 = runway.ends[1];

  // Calculate length
  const R = 6371e3;
  const dLat = ((e2.latitude - e1.latitude) * Math.PI) / 180;
  const dLon = ((e2.longitude - e1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((e1.latitude * Math.PI) / 180) *
      Math.cos((e2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const lengthM = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  const lengthFt = Math.round(lengthM * 3.28084);

  const surfaceKeys: Record<number, string> = {
    1: 'asphalt',
    2: 'concrete',
    3: 'grass',
    4: 'dirt',
    5: 'gravel',
  };

  const hasLighting = e1.lighting > 0 || e2.lighting > 0;

  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <button onClick={onClick} className="w-full text-left transition-opacity hover:opacity-80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">
              {e1.name}/{e2.name}
            </span>
            {ilsCount && ilsCount > 0 && (
              <Badge variant="success" className="px-1 py-0.5 text-[9px]">
                ILS
              </Badge>
            )}
            {hasLighting && (
              <Badge variant="warning" className="px-1 py-0.5 text-[9px]">
                LGT
              </Badge>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{lengthFt}'</span>
          <span>×</span>
          <span>{Math.round(runway.width * 3.28084)}'</span>
          <span className="opacity-50">•</span>
          <span>{t(`airportInfo.surfaces.${surfaceKeys[runway.surface_type] || 'unknown'}`)}</span>
        </div>
      </button>

      {onSelectEnd && (
        <div className="mt-2 flex gap-2 border-t border-border/30 pt-2">
          <span className="self-center text-[10px] text-muted-foreground/50">
            {t('sidebar.startFrom')}
          </span>
          {[e1, e2].map((end) => (
            <Button
              key={end.name}
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEnd({ name: end.name, latitude: end.latitude, longitude: end.longitude });
              }}
              className={cn(
                'h-auto flex-1 rounded px-2 py-1 font-mono text-xs font-medium',
                selectedEndName === end.name
                  ? 'border border-green-500/30 bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {end.name}
              {selectedEndName === end.name && <Rocket className="ml-1 inline h-2.5 w-2.5" />}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
