import { Card } from '@/components/ui/card';
import { WeatherData } from '@/types/weather';

interface CompassWidgetProps {
  mapBearing: number;
  weather: WeatherData | null;
}

export default function CompassWidget({ mapBearing, weather }: CompassWidgetProps) {
  const decoded = weather?.metar?.decoded;
  const wind = decoded?.wind;

  return (
    <Card className="absolute left-4 top-16 z-10 border-border/50 bg-background/90 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Compass */}
        <div className="flex flex-col items-center">
          <div className="mb-1 font-mono text-[9px] text-muted-foreground">HDG</div>
          <div className="relative h-14 w-14">
            <svg viewBox="0 0 56 56" className="h-full w-full">
              {/* Outer ring */}
              <circle
                cx="28"
                cy="28"
                r="26"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth="1"
              />
              {/* Cardinal directions - rotate opposite to map bearing */}
              <g transform={`rotate(${-mapBearing}, 28, 28)`}>
                {/* N marker */}
                <text
                  x="28"
                  y="9"
                  textAnchor="middle"
                  className="fill-destructive font-mono text-[8px] font-bold"
                >
                  N
                </text>
                {/* E marker */}
                <text
                  x="48"
                  y="31"
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-[7px]"
                >
                  E
                </text>
                {/* S marker */}
                <text
                  x="28"
                  y="52"
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-[7px]"
                >
                  S
                </text>
                {/* W marker */}
                <text
                  x="8"
                  y="31"
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-[7px]"
                >
                  W
                </text>
                {/* Tick marks */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                  <line
                    key={deg}
                    x1="28"
                    y1="4"
                    x2="28"
                    y2={deg % 90 === 0 ? '8' : '6'}
                    stroke={deg === 0 ? 'hsl(var(--destructive))' : 'currentColor'}
                    strokeOpacity={deg === 0 ? 1 : 0.3}
                    strokeWidth={deg % 90 === 0 ? '1.5' : '1'}
                    transform={`rotate(${deg}, 28, 28)`}
                  />
                ))}
              </g>
              {/* Fixed aircraft indicator (always points up) */}
              <polygon
                points="28,14 24,34 28,30 32,34"
                className="fill-primary stroke-primary"
                strokeWidth="0.5"
              />
            </svg>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {Math.round(mapBearing).toString().padStart(3, '0')}°
          </div>
        </div>

        {/* Wind Indicator */}
        <div className="flex flex-col items-center">
          <div className="mb-1 font-mono text-[9px] text-muted-foreground">WIND</div>
          {wind && wind.speed > 0 ? (
            <>
              <div className="relative h-12 w-12">
                <svg viewBox="0 0 48 48" className="h-full w-full">
                  <circle
                    cx="24"
                    cy="24"
                    r="22"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.2"
                    strokeWidth="1"
                  />
                  {wind.direction !== 'VRB' && (
                    <g
                      transform={`rotate(${(wind.direction as number) - mapBearing + 180}, 24, 24)`}
                    >
                      <line
                        x1="24"
                        y1="8"
                        x2="24"
                        y2="40"
                        className="stroke-cyan-500"
                        strokeWidth="2"
                      />
                      <polygon points="24,8 20,16 28,16" className="fill-cyan-500" />
                    </g>
                  )}
                  {wind.direction === 'VRB' && (
                    <circle cx="24" cy="24" r="6" className="fill-cyan-500/50" />
                  )}
                </svg>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-cyan-500">
                {wind.direction === 'VRB' ? 'VRB' : `${String(wind.direction).padStart(3, '0')}°`}
                <span className="mx-0.5 text-muted-foreground">@</span>
                {wind.speed}kt
                {wind.gust && <span className="ml-0.5 text-amber-500">G{wind.gust}</span>}
              </div>
            </>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center">
              <span className="font-mono text-[10px] text-muted-foreground">
                {weather?.loading ? '...' : 'CALM'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
