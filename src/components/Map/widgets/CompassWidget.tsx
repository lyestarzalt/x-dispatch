import { useMemo } from 'react';
import { cn } from '@/lib/utils/helpers';

interface CompassWidgetProps {
  mapBearing: number;
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

export default function CompassWidget({ mapBearing }: CompassWidgetProps) {
  // Format heading for display
  const headingDisplay = useMemo(
    () => Math.round(mapBearing).toString().padStart(3, '0'),
    [mapBearing]
  );

  return (
    <div className="absolute bottom-10 left-12 z-10" role="region" aria-label="Compass heading">
      <div
        className={cn(
          'flex flex-col items-center rounded-xl border p-3',
          'border-white/[0.08] bg-[#0d1117]/90 shadow-2xl shadow-black/50',
          'backdrop-blur-xl'
        )}
      >
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-full w-full"
            role="img"
            aria-hidden="true"
          >
            {/* Outer glow ring */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS + 4}
              fill="none"
              stroke="rgba(34, 211, 238, 0.1)"
              strokeWidth="1"
            />
            {/* Bezel - outer ring */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS + 2}
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1.5"
            />
            {/* Inner background */}
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="rgba(13, 17, 23, 0.8)" />

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
                  stroke={tick.isNorth ? '#f87171' : 'rgba(255, 255, 255, 0.5)'}
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
                  fontFamily="ui-monospace, monospace"
                  fontWeight={pos.fontWeight}
                  fill={pos.isNorth ? '#f87171' : 'rgba(255, 255, 255, 0.6)'}
                >
                  {pos.label}
                </text>
              ))}
            </g>

            {/* Fixed lubber line (top reference) */}
            <polygon points={LUBBER_POINTS} fill="#22d3ee" />

            {/* Center aircraft symbol */}
            <g transform={`translate(${CENTER}, ${CENTER})`}>
              <line x1="0" y1="-8" x2="0" y2="8" stroke="#22d3ee" strokeWidth="2" />
              <line x1="-10" y1="2" x2="10" y2="2" stroke="#22d3ee" strokeWidth="2" />
              <line x1="-4" y1="7" x2="4" y2="7" stroke="#22d3ee" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
        {/* Digital readout */}
        <div className="mt-2 rounded-md border border-white/[0.08] bg-black/30 px-3 py-1 font-mono text-sm font-bold tabular-nums tracking-wider text-cyan-400">
          {headingDisplay}°
        </div>
      </div>
    </div>
  );
}
