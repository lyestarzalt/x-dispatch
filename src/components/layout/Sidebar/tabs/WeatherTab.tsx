import { useState } from 'react';
import { Runway } from '@/lib/aptParser/types';
import { WeatherData } from '@/types/weather';
import { DecodedMETAR, FlightCategory, calculateWindComponents } from '@/utils/decodeMetar';

interface WeatherContentProps {
  weather: WeatherData;
  selectedRunway?: Runway | null;
}

const FLIGHT_CATEGORY_COLORS: Record<FlightCategory, { bg: string; text: string }> = {
  VFR: { bg: 'bg-green-500/20', text: 'text-green-400' },
  MVFR: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  IFR: { bg: 'bg-red-500/20', text: 'text-red-400' },
  LIFR: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

export default function WeatherContent({ weather, selectedRunway }: WeatherContentProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [activeTab, setActiveTab] = useState<'metar' | 'taf'>('metar');

  if (weather.loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="font-mono text-xs text-muted-foreground">Fetching weather...</span>
      </div>
    );
  }

  if (weather.error) {
    return (
      <div className="rounded border border-destructive/20 bg-destructive/10 p-2">
        <span className="font-mono text-xs text-destructive">{weather.error}</span>
      </div>
    );
  }

  if (!weather.metar && !weather.taf) {
    return (
      <div className="py-4 text-center font-mono text-xs text-muted-foreground/60">
        No weather data available
      </div>
    );
  }

  const decoded = weather.metar?.decoded;

  return (
    <div className="space-y-3">
      {/* Flight category badge */}
      {decoded && (
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${FLIGHT_CATEGORY_COLORS[decoded.flightCategory].bg} ${FLIGHT_CATEGORY_COLORS[decoded.flightCategory].text}`}
          >
            {decoded.flightCategory}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {decoded.observationTime?.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            Z
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setActiveTab('metar')}
          className={`flex-1 py-1.5 font-mono text-[10px] ${
            activeTab === 'metar'
              ? 'border-b border-primary text-foreground'
              : 'text-muted-foreground/60'
          }`}
        >
          METAR
        </button>
        <button
          onClick={() => setActiveTab('taf')}
          className={`flex-1 py-1.5 font-mono text-[10px] ${
            activeTab === 'taf'
              ? 'border-b border-primary text-foreground'
              : 'text-muted-foreground/60'
          }`}
          disabled={!weather.taf}
        >
          TAF
        </button>
      </div>

      {activeTab === 'metar' && decoded && (
        <div className="space-y-2">
          {/* Conditions grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Visibility */}
            {decoded.visibility && (
              <div className="rounded bg-secondary/30 p-2">
                <div className="font-mono text-[9px] text-muted-foreground/60">VISIBILITY</div>
                <div className="font-mono text-sm text-foreground">
                  {decoded.visibility.modifier === 'P' && '>'}
                  {decoded.visibility.modifier === 'M' && '<'}
                  {decoded.visibility.value}
                  {decoded.visibility.unit === 'SM' ? ' SM' : 'm'}
                </div>
              </div>
            )}

            {/* Ceiling/Clouds */}
            {decoded.clouds.length > 0 && (
              <div className="rounded bg-secondary/30 p-2">
                <div className="font-mono text-[9px] text-muted-foreground/60">CLOUDS</div>
                <div className="space-y-0.5">
                  {decoded.clouds.slice(0, 2).map((c, i) => (
                    <div key={i} className="font-mono text-[11px] text-foreground">
                      {c.cover} {c.altitude ? `${(c.altitude * 100).toLocaleString()}ft` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Temperature */}
            {decoded.temperature !== null && (
              <div className="rounded bg-secondary/30 p-2">
                <div className="font-mono text-[9px] text-muted-foreground/60">TEMP/DEW</div>
                <div className="font-mono text-sm text-foreground">
                  {decoded.temperature}° / {decoded.dewpoint}°C
                </div>
              </div>
            )}

            {/* Altimeter */}
            {decoded.altimeter !== null && (
              <div className="rounded bg-secondary/30 p-2">
                <div className="font-mono text-[9px] text-muted-foreground/60">ALTIMETER</div>
                <div className="font-mono text-sm text-foreground">
                  {decoded.altimeterUnit === 'inHg'
                    ? decoded.altimeter.toFixed(2)
                    : decoded.altimeter}
                  {decoded.altimeterUnit === 'inHg' ? '"' : ' hPa'}
                </div>
              </div>
            )}
          </div>

          {/* Weather phenomena */}
          {decoded.weather.length > 0 && (
            <div className="rounded border border-warning/20 bg-warning/10 p-2">
              <div className="font-mono text-xs text-warning">{decoded.weather.join(', ')}</div>
            </div>
          )}

          {/* Runway wind components */}
          {selectedRunway &&
            decoded.wind &&
            decoded.wind.direction !== 'VRB' &&
            decoded.wind.speed > 0 && (
              <RunwayWindComponent decoded={decoded} runway={selectedRunway} />
            )}

          {/* Raw/Human toggle */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="font-mono text-[9px] text-muted-foreground/60 hover:text-muted-foreground"
          >
            {showRaw ? '▼ Hide raw' : '▶ Show raw'}
          </button>
          {showRaw ? (
            <div className="break-all rounded bg-secondary/50 p-2 font-mono text-[9px] text-muted-foreground">
              {weather.metar?.raw}
            </div>
          ) : (
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {decoded.humanReadable}
            </p>
          )}
        </div>
      )}

      {activeTab === 'taf' && weather.taf && (
        <div className="rounded bg-secondary/50 p-2">
          <pre className="whitespace-pre-wrap break-all font-mono text-[9px] text-muted-foreground">
            {weather.taf}
          </pre>
        </div>
      )}
    </div>
  );
}

function RunwayWindComponent({ decoded, runway }: { decoded: DecodedMETAR; runway: Runway }) {
  if (!decoded.wind || decoded.wind.direction === 'VRB' || decoded.wind.speed === 0) {
    return null;
  }

  const e1 = runway.ends[0],
    e2 = runway.ends[1];
  const heading1 = parseInt(e1.name.replace(/[LRC]/g, ''), 10) * 10;
  const heading2 = parseInt(e2.name.replace(/[LRC]/g, ''), 10) * 10;

  const comp1 = calculateWindComponents(
    decoded.wind.direction as number,
    decoded.wind.speed,
    heading1
  );
  const comp2 = calculateWindComponents(
    decoded.wind.direction as number,
    decoded.wind.speed,
    heading2
  );

  const favorable = comp1.headwind > comp2.headwind ? e1 : e2;
  const favorableComp = comp1.headwind > comp2.headwind ? comp1 : comp2;

  return (
    <div className="rounded border border-success/20 bg-success/10 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[9px] text-muted-foreground">
          RUNWAY {e1.name}/{e2.name}
        </span>
        <span className="font-mono text-[9px] font-bold text-success">Use {favorable.name}</span>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">
        {favorableComp.headwind > 0 ? 'HW' : 'TW'} {Math.abs(favorableComp.headwind)}kt • XW{' '}
        {favorableComp.crosswind}kt {favorableComp.crosswindDirection}
      </div>
    </div>
  );
}
