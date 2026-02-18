import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { DecodedMETAR } from '@/lib/utils/format/metar';

interface CompassWidgetProps {
  mapBearing: number;
  metar?: DecodedMETAR | null;
}

// Constants
const SIZE = 72;
const CENTER = SIZE / 2;
const RADIUS = 32;

// Pre-calculate tick marks (static, never changes)
const TICK_MARKS = Array.from({ length: 72 }, (_, i) => {
  const deg = i * 5;
  const isMajor = deg % 30 === 0;
  const isMedium = deg % 10 === 0;
  return {
    deg,
    tickLength: isMajor ? 6 : isMedium ? 4 : 2,
    tickWidth: isMajor ? 1.5 : 1,
    opacity: isMajor ? 0.9 : isMedium ? 0.5 : 0.3,
    isNorth: deg === 0,
  };
});

// Pre-calculate label positions (static, never changes)
const LABEL_POSITIONS = Object.entries({
  0: 'N',
  30: '3',
  60: '6',
  90: 'E',
  120: '12',
  150: '15',
  180: 'S',
  210: '21',
  240: '24',
  270: 'W',
  300: '30',
  330: '33',
}).map(([deg, label]) => {
  const angle = ((Number(deg) - 90) * Math.PI) / 180;
  const labelRadius = RADIUS - 12;
  const isCardinal = ['N', 'E', 'S', 'W'].includes(label);
  return {
    deg: Number(deg),
    label,
    x: CENTER + labelRadius * Math.cos(angle),
    y: CENTER + labelRadius * Math.sin(angle),
    fontSize: isCardinal ? 9 : 7,
    fontWeight: isCardinal ? 'bold' : 'normal',
    isNorth: label === 'N',
  };
});

// Lubber line points (static)
const LUBBER_POINTS = `${CENTER},${CENTER - RADIUS - 1} ${CENTER - 3},${CENTER - RADIUS + 5} ${CENTER + 3},${CENTER - RADIUS + 5}`;

export default function CompassWidget({ mapBearing, metar }: CompassWidgetProps) {
  const wind = metar?.wind;

  // Memoize wind rotation calculation
  const windRotation = useMemo(() => {
    if (!wind || wind.direction === 'VRB') return 0;
    return (wind.direction as number) - mapBearing + 180;
  }, [wind, mapBearing]);

  // Format heading for display
  const headingDisplay = useMemo(
    () => Math.round(mapBearing).toString().padStart(3, '0'),
    [mapBearing]
  );

  return (
    <Card
      className="absolute left-4 top-16 z-10 border-border bg-card p-2"
      role="region"
      aria-label="Navigation instruments"
    >
      <div className="flex items-center gap-3">
        {/* Heading Indicator */}
        <div
          className="flex flex-col items-center"
          aria-label={`Heading ${headingDisplay} degrees`}
        >
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="h-full w-full"
              role="img"
              aria-hidden="true"
            >
              {/* Bezel - outer ring */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS + 3}
                fill="none"
                className="stroke-border"
                strokeWidth="2"
              />
              {/* Inner background */}
              <circle cx={CENTER} cy={CENTER} r={RADIUS} className="fill-card" />

              {/* Rotating compass rose with smooth transition */}
              <g
                style={{
                  transform: `rotate(${-mapBearing}deg)`,
                  transformOrigin: `${CENTER}px ${CENTER}px`,
                  transition: 'transform 150ms ease-out',
                }}
              >
                {/* Tick marks */}
                {TICK_MARKS.map((tick) => (
                  <line
                    key={tick.deg}
                    x1={CENTER}
                    y1={CENTER - RADIUS + 2}
                    x2={CENTER}
                    y2={CENTER - RADIUS + 2 + tick.tickLength}
                    stroke={
                      tick.isNorth ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'
                    }
                    strokeOpacity={tick.opacity}
                    strokeWidth={tick.tickWidth}
                    transform={`rotate(${tick.deg}, ${CENTER}, ${CENTER})`}
                  />
                ))}

                {/* Heading labels */}
                {LABEL_POSITIONS.map((pos) => (
                  <text
                    key={pos.deg}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={pos.fontSize}
                    fontFamily="monospace"
                    fontWeight={pos.fontWeight}
                    fill={pos.isNorth ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'}
                  >
                    {pos.label}
                  </text>
                ))}
              </g>

              {/* Fixed lubber line (top reference) */}
              <polygon points={LUBBER_POINTS} className="fill-primary" />

              {/* Center aircraft symbol */}
              <g transform={`translate(${CENTER}, ${CENTER})`}>
                <line x1="0" y1="-8" x2="0" y2="8" className="stroke-primary" strokeWidth="2" />
                <line x1="-10" y1="2" x2="10" y2="2" className="stroke-primary" strokeWidth="2" />
                <line x1="-4" y1="7" x2="4" y2="7" className="stroke-primary" strokeWidth="1.5" />
              </g>
            </svg>
          </div>
          {/* Digital readout */}
          <div className="mt-1 rounded bg-card px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-foreground">
            {headingDisplay}°
          </div>
        </div>

        {/* Wind Indicator */}
        <div
          className="flex flex-col items-center"
          aria-label={
            wind && wind.speed > 0
              ? `Wind from ${wind.direction === 'VRB' ? 'variable' : wind.direction + ' degrees'} at ${wind.speed} knots${wind.gust ? ` gusting ${wind.gust}` : ''}`
              : 'Wind calm'
          }
        >
          <div className="text-xs text-muted-foreground">WIND</div>
          {wind && wind.speed > 0 ? (
            <>
              <div className="relative h-14 w-14">
                <svg viewBox="0 0 56 56" className="h-full w-full" role="img" aria-hidden="true">
                  {/* Outer ring */}
                  <circle
                    cx="28"
                    cy="28"
                    r="26"
                    fill="none"
                    className="stroke-border"
                    strokeWidth="1"
                  />
                  <circle cx="28" cy="28" r="24" className="fill-card" />

                  {/* Wind direction arrow with smooth transition */}
                  {wind.direction !== 'VRB' && (
                    <g
                      style={{
                        transform: `rotate(${windRotation}deg)`,
                        transformOrigin: '28px 28px',
                        transition: 'transform 150ms ease-out',
                      }}
                    >
                      <line
                        x1="28"
                        y1="8"
                        x2="28"
                        y2="38"
                        className="stroke-info"
                        strokeWidth="2"
                      />
                      <polygon points="28,6 24,14 32,14" className="fill-info" />
                      {/* Wind barbs based on speed */}
                      {wind.speed >= 5 && (
                        <line
                          x1="28"
                          y1="36"
                          x2="36"
                          y2="32"
                          className="stroke-info"
                          strokeWidth="1.5"
                        />
                      )}
                      {wind.speed >= 10 && (
                        <line
                          x1="28"
                          y1="32"
                          x2="36"
                          y2="28"
                          className="stroke-info"
                          strokeWidth="1.5"
                        />
                      )}
                      {wind.speed >= 15 && (
                        <line
                          x1="28"
                          y1="28"
                          x2="36"
                          y2="24"
                          className="stroke-info"
                          strokeWidth="1.5"
                        />
                      )}
                    </g>
                  )}
                  {wind.direction === 'VRB' && (
                    <circle
                      cx="28"
                      cy="28"
                      r="8"
                      className="fill-info/30 stroke-info"
                      strokeWidth="1"
                    />
                  )}
                </svg>
              </div>
              <div className="mt-1 font-mono text-xs">
                <span className="text-info">
                  {wind.direction === 'VRB' ? 'VRB' : `${String(wind.direction).padStart(3, '0')}°`}
                </span>
                <span className="mx-0.5 text-muted-foreground">/</span>
                <span className="text-foreground">{wind.speed}</span>
                {wind.gust && <span className="text-warning">G{wind.gust}</span>}
                <span className="text-muted-foreground">kt</span>
              </div>
            </>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground">
                {metar ? 'CALM' : '---'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
