import { useMemo } from 'react';
import { Moon, Sun } from 'lucide-react';
import SunCalc from 'suncalc';

interface SunArcProps {
  timeOfDay: number;
  latitude: number;
  longitude: number;
  onTimeChange: (time: number) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function toDecimalHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function SunArc({ timeOfDay, latitude, longitude, onTimeChange }: SunArcProps) {
  const sunTimes = useMemo(() => {
    const date = new Date();
    const times = SunCalc.getTimes(date, latitude, longitude);
    return {
      sunrise: times.sunrise,
      sunset: times.sunset,
      sunriseHours: toDecimalHours(times.sunrise),
      sunsetHours: toDecimalHours(times.sunset),
    };
  }, [latitude, longitude]);

  const isDay = timeOfDay >= sunTimes.sunriseHours && timeOfDay <= sunTimes.sunsetHours;

  const dayDuration = sunTimes.sunsetHours - sunTimes.sunriseHours;
  const nightDuration = 24 - dayDuration;

  let arcProgress: number;
  if (isDay) {
    arcProgress = (timeOfDay - sunTimes.sunriseHours) / dayDuration;
  } else {
    if (timeOfDay > sunTimes.sunsetHours) {
      const nightProgress = (timeOfDay - sunTimes.sunsetHours) / nightDuration;
      arcProgress = 1 + nightProgress * 0.5; // Goes from 1 to 1.5
    } else {
      const nightProgress = (24 - sunTimes.sunsetHours + timeOfDay) / nightDuration;
      arcProgress = 1 + nightProgress * 0.5;
    }
  }

  const width = 240;
  const height = 100;
  const arcRadius = 85;
  const centerX = width / 2;
  const centerY = height - 10;

  const angle = Math.PI - arcProgress * Math.PI;
  const sunX = centerX + arcRadius * Math.cos(Math.max(0, Math.min(Math.PI, angle)));
  const sunY = centerY - arcRadius * Math.sin(Math.max(0, Math.min(Math.PI, angle)));

  const clampedSunY = Math.min(sunY, centerY);
  const isBelowHorizon = !isDay;

  const getSkyGradient = () => {
    const sunriseStart = sunTimes.sunriseHours - 0.5;
    const sunriseEnd = sunTimes.sunriseHours + 0.5;
    const sunsetStart = sunTimes.sunsetHours - 0.5;
    const sunsetEnd = sunTimes.sunsetHours + 0.5;

    if (timeOfDay >= sunriseStart && timeOfDay <= sunriseEnd) {
      // Sunrise - orange to blue
      return ['#1e3a5f', '#f97316', '#fbbf24'];
    } else if (timeOfDay >= sunsetStart && timeOfDay <= sunsetEnd) {
      // Sunset - orange to purple
      return ['#1e3a5f', '#dc2626', '#f97316'];
    } else if (isDay) {
      // Day - blue sky
      return ['#0ea5e9', '#38bdf8', '#7dd3fc'];
    } else {
      // Night - dark blue
      return ['#0f172a', '#1e293b', '#1e3a5f'];
    }
  };

  const skyColors = getSkyGradient();

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relativeX = (x - (rect.width - width) / 2 - centerX) / arcRadius;

    if (relativeX >= -1 && relativeX <= 1) {
      const clickAngle = Math.acos(Math.max(-1, Math.min(1, relativeX)));
      const progress = 1 - clickAngle / Math.PI;
      const newTime = sunTimes.sunriseHours + progress * dayDuration;
      onTimeChange(Math.max(0, Math.min(24, newTime)));
    }
  };

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-pointer"
        onClick={handleClick}
      >
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={skyColors[0]} />
            <stop offset="50%" stopColor={skyColors[1]} />
            <stop offset="100%" stopColor={skyColors[2]} />
          </linearGradient>
          <clipPath id="arcClip">
            <path
              d={`M ${centerX - arcRadius} ${centerY}
                  A ${arcRadius} ${arcRadius} 0 0 1 ${centerX + arcRadius} ${centerY}
                  L ${centerX + arcRadius} 0
                  L ${centerX - arcRadius} 0 Z`}
            />
          </clipPath>
        </defs>

        <rect
          x={centerX - arcRadius}
          y="0"
          width={arcRadius * 2}
          height={centerY}
          fill="url(#skyGradient)"
          clipPath="url(#arcClip)"
          rx="4"
        />

        <path
          d={`M ${centerX - arcRadius} ${centerY} A ${arcRadius} ${arcRadius} 0 0 1 ${centerX + arcRadius} ${centerY}`}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        <line
          x1={centerX - arcRadius - 10}
          y1={centerY}
          x2={centerX + arcRadius + 10}
          y2={centerY}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
        />

        {!isBelowHorizon && (
          <circle
            cx={sunX}
            cy={clampedSunY}
            r="18"
            fill={isDay ? 'rgba(251, 191, 36, 0.3)' : 'rgba(226, 232, 240, 0.2)'}
          />
        )}
      </svg>

      <div
        className="absolute transition-all duration-300"
        style={{
          left: `calc(50% + ${sunX - centerX}px - 10px)`,
          top: `${isBelowHorizon ? centerY - 20 : clampedSunY - 10}px`,
          opacity: isBelowHorizon ? 0.4 : 1,
        }}
      >
        {isDay ? (
          <Sun className="h-5 w-5 text-yellow-400 drop-shadow-lg" fill="currentColor" />
        ) : (
          <Moon className="h-5 w-5 text-slate-300 drop-shadow-lg" fill="currentColor" />
        )}
      </div>

      <div className="mt-2 flex justify-between px-4 text-xs">
        <div className="flex flex-col items-center text-muted-foreground">
          <Sun className="mb-0.5 h-3 w-3 text-orange-400" />
          <span>{formatTime(sunTimes.sunrise)}</span>
        </div>
        <div className="flex flex-col items-center text-muted-foreground">
          <Moon className="mb-0.5 h-3 w-3 text-slate-400" />
          <span>{formatTime(sunTimes.sunset)}</span>
        </div>
      </div>
    </div>
  );
}
