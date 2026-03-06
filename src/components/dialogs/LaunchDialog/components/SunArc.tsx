import { useEffect, useMemo, useRef, useState } from 'react';
import SunCalc from 'suncalc';
import tzlookup from 'tz-lookup';
import { Slider } from '@/components/ui/slider';
import { formatZulu } from '@/lib/utils/format';

interface SunArcProps {
  timeOfDay: number;
  latitude: number;
  longitude: number;
  onTimeChange: (time: number) => void;
}

function formatHours(hours: number): string {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((((hours % 1) + 1) % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getHoursInTimezone(date: Date, timezone: string): number {
  const str = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: false,
  });
  const [h, m] = str.split(':').map(Number);
  return h + m / 60;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* Read CSS custom properties as hex — SVG gradient stops require hex values */
function readPalette(el: HTMLElement) {
  const s = getComputedStyle(el);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d')!;

  function toHex(varName: string): string {
    const raw = s.getPropertyValue(varName).trim();
    if (!raw) return '#000000';
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = `oklch(${raw})`;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
  }

  return {
    bg: toHex('--background'),
    card: toHex('--card'),
    border: toHex('--border'),
    muted: toHex('--muted-foreground'),
    cyan: toHex('--primary'),
    cyanGlow: toHex('--xp-cyan-glow'),
    cyanLt: toHex('--xp-cyan-light'),
    cyanDk: toHex('--xp-cyan-dark'),
    cyanDeep: toHex('--xp-cyan-deepest'),
    white: '#FFFFFF',
    amber: toHex('--warning'),
  };
}

type Palette = ReturnType<typeof readPalette>;

const W = 420;
const H = 200;

function curveY(hour: number, rise: number, set: number): number {
  const noon = (rise + set) / 2;
  const phase = ((hour - noon) / 24) * Math.PI * 2;
  return 0.5 + Math.cos(phase) * -0.26;
}

function hourToX(hour: number, pad = 0.14): number {
  return pad + (hour / 24) * (1 - 2 * pad);
}

function buildCurve(rise: number, set: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const h = (i / 200) * 24;
    const x = hourToX(h) * W;
    const y = curveY(h, rise, set) * H;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function buildTraversed(hour: number, rise: number, set: number): string {
  const pts: string[] = [];
  const steps = Math.round((hour / 24) * 200);
  for (let i = 0; i <= steps; i++) {
    const h = (i / 200) * 24;
    const x = hourToX(h) * W;
    const y = curveY(h, rise, set) * H;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

/* Twinkling stars — only rendered at night */
function Stars({ opacity, C }: { opacity: number; C: Palette }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 15 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.45 + H * 0.02,
        r: Math.random() * 1 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.3,
        base: Math.random() * 0.25 + 0.4,
      })),
    []
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (opacity < 0.05) return;
    let raf: number;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [opacity]);

  if (opacity < 0.05) return null;
  const time = tick * 0.018;

  return (
    <g opacity={opacity}>
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={C.cyanGlow}
          opacity={clamp(s.base + Math.sin(time * s.speed + s.phase) * 0.3, 0.06, 0.8)}
        />
      ))}
    </g>
  );
}

export function SunArc({ timeOfDay, latitude, longitude, onTimeChange }: SunArcProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const C = useMemo(() => {
    const el = rootRef.current ?? document.documentElement;
    return readPalette(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef.current]);

  const { timezone, sunriseHours, sunsetHours, localTime, zuluTime, dateStr } = useMemo(() => {
    const tz = tzlookup(latitude, longitude) || 'UTC';
    const today = new Date();
    const times = SunCalc.getTimes(today, latitude, longitude);

    const date = today.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: tz,
    });

    return {
      timezone: tz,
      sunriseHours: getHoursInTimezone(times.sunrise, tz),
      sunsetHours: getHoursInTimezone(times.sunset, tz),
      localTime: formatHours(timeOfDay),
      zuluTime: formatZulu(timeOfDay),
      dateStr: date,
    };
  }, [latitude, longitude, timeOfDay]);

  const isDay = timeOfDay >= sunriseHours && timeOfDay <= sunsetHours;
  const horizY = 0.5 * H;
  const bodyCx = hourToX(timeOfDay) * W;
  const bodyCy = curveY(timeOfDay, sunriseHours, sunsetHours) * H;

  const nightOp = isDay
    ? 0
    : clamp(
        timeOfDay >= 20 || timeOfDay <= 4
          ? 1
          : timeOfDay > sunsetHours
            ? (timeOfDay - sunsetHours) / 1.5
            : (sunriseHours - timeOfDay) / 1.5,
        0,
        1
      );

  const statusText = useMemo(() => {
    if (isDay) {
      const remaining = sunsetHours - timeOfDay;
      const h = Math.floor(remaining);
      const m = Math.round((remaining % 1) * 60);
      return `${h}h ${m}m until sunset`;
    }
    const toSunrise =
      timeOfDay > sunsetHours ? 24 - timeOfDay + sunriseHours : sunriseHours - timeOfDay;
    const h = Math.floor(toSunrise);
    const m = Math.round((toSunrise % 1) * 60);
    return `${h}h ${m}m until sunrise`;
  }, [isDay, timeOfDay, sunriseHours, sunsetHours]);

  const fullCurve = useMemo(
    () => buildCurve(sunriseHours, sunsetHours),
    [sunriseHours, sunsetHours]
  );
  const traversedCurve = useMemo(
    () => buildTraversed(timeOfDay, sunriseHours, sunsetHours),
    [timeOfDay, sunriseHours, sunsetHours]
  );

  return (
    <div ref={rootRef} className="space-y-2">
      {/* SVG arc visualization — bleeds to section edges */}
      <div className="-mx-4 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="sun-skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isDay ? C.cyanDeep : C.bg}
                stopOpacity={isDay ? '0.15' : '0.4'}
              />
              <stop offset="60%" stopColor={C.card} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sun-curveStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.cyanLt} stopOpacity="0" />
              <stop offset="8%" stopColor={C.cyanLt} stopOpacity="0.2" />
              <stop offset="92%" stopColor={C.cyanLt} stopOpacity="0.2" />
              <stop offset="100%" stopColor={C.cyanLt} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sun-traversedStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={C.cyanLt} stopOpacity="0" />
              <stop offset="12%" stopColor={isDay ? C.amber : C.cyan} stopOpacity="0.5" />
              <stop offset="100%" stopColor={isDay ? C.amber : C.cyan} stopOpacity="0.6" />
            </linearGradient>
            <radialGradient id="sun-sunOuter">
              <stop offset="0%" stopColor={C.amber} stopOpacity="0.2" />
              <stop offset="100%" stopColor={C.amber} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sun-sunFace">
              <stop offset="0%" stopColor="#FFF8E8" />
              <stop offset="100%" stopColor={C.amber} />
            </radialGradient>
            <radialGradient id="sun-moonOuter">
              <stop offset="0%" stopColor={C.cyanGlow} stopOpacity="0.14" />
              <stop offset="100%" stopColor={C.cyanGlow} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="sun-moonFace">
              <stop offset="0%" stopColor="#F2F5FF" />
              <stop offset="100%" stopColor="#BCC8E4" />
            </radialGradient>
            <mask id="sun-crescent">
              <circle cx={bodyCx} cy={bodyCy} r={9} fill="white" />
              <circle cx={bodyCx + 4} cy={bodyCy - 3} r={7.5} fill="black" />
            </mask>
            <filter id="sun-glow">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <filter id="sun-softGlow">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Sky fill */}
          <rect width={W} height={H} fill="url(#sun-skyGrad)" />

          {/* Stars at night */}
          <Stars opacity={nightOp} C={C} />

          {/* Horizon line */}
          <line
            x1={20}
            y1={horizY}
            x2={W - 20}
            y2={horizY}
            stroke={C.border}
            strokeWidth="0.75"
            opacity="0.6"
          />

          {/* Full curve — subtle */}
          <path d={fullCurve} fill="none" stroke="url(#sun-curveStroke)" strokeWidth="1.5" />

          {/* Traversed curve — brighter */}
          <path
            d={traversedCurve}
            fill="none"
            stroke="url(#sun-traversedStroke)"
            strokeWidth="1.5"
          />

          {/* Sun or Moon body */}
          {isDay ? (
            <g>
              <circle
                cx={bodyCx}
                cy={bodyCy}
                r={34}
                fill="url(#sun-sunOuter)"
                filter="url(#sun-glow)"
              />
              <circle
                cx={bodyCx}
                cy={bodyCy}
                r={16}
                fill="url(#sun-sunOuter)"
                filter="url(#sun-softGlow)"
              />
              <circle cx={bodyCx} cy={bodyCy} r={7} fill="url(#sun-sunFace)" />
              <circle
                cx={bodyCx}
                cy={bodyCy}
                r={7}
                fill="none"
                stroke="rgba(255,248,232,0.25)"
                strokeWidth="0.5"
              />
            </g>
          ) : (
            <g>
              <circle
                cx={bodyCx}
                cy={bodyCy}
                r={28}
                fill="url(#sun-moonOuter)"
                filter="url(#sun-glow)"
              />
              <circle
                cx={bodyCx}
                cy={bodyCy}
                r={9}
                fill="url(#sun-moonFace)"
                mask="url(#sun-crescent)"
              />
            </g>
          )}

          {/* Sunrise / Sunset labels inside SVG */}
          <text x={26} y={H - 24} fill={C.muted} fontSize="8" fontWeight="500" letterSpacing="1.5">
            SUNRISE
          </text>
          <text x={26} y={H - 10} fill={C.cyanGlow} fontSize="14" fontWeight="300">
            {formatHours(sunriseHours)}
          </text>
          <text
            x={W - 26}
            y={H - 24}
            fill={C.muted}
            fontSize="8"
            fontWeight="500"
            letterSpacing="1.5"
            textAnchor="end"
          >
            SUNSET
          </text>
          <text
            x={W - 26}
            y={H - 10}
            fill={C.cyanGlow}
            fontSize="14"
            fontWeight="300"
            textAnchor="end"
          >
            {formatHours(sunsetHours)}
          </text>
        </svg>
      </div>

      {/* Time readout */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-lg font-semibold">{localTime}</span>
          <span className="text-xs text-muted-foreground">local</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px]" style={{ color: isDay ? C.amber : C.cyan, opacity: 0.8 }}>
            {statusText}
          </span>
          <span className="font-mono text-sm text-muted-foreground">{zuluTime}</span>
        </div>
      </div>

      {/* Radix Slider */}
      <Slider
        value={[timeOfDay]}
        onValueChange={(v) => onTimeChange(v[0])}
        min={0}
        max={24}
        step={0.25}
      />

      {/* Date + timezone */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{dateStr}</span>
        <span>{timezone.split('/').pop()?.replace('_', ' ')}</span>
      </div>
    </div>
  );
}
