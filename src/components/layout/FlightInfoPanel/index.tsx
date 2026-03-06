import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Fuel,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Route,
  Scale,
  X,
} from 'lucide-react';
import { DistanceUnit, parseMetar } from 'metar-taf-parser';
import type { IAltimeter, IMetar, IWind, Visibility } from 'metar-taf-parser';
import { SimbriefLogo } from '@/components/ui/SimbriefLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils/helpers';
import {
  formatDistance,
  formatFlightTime,
  formatFuel,
  formatWeight,
} from '@/queries/useSimbriefQuery';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import type { SimBriefOFP } from '@/types/simbrief';

type TabId = 'overview' | 'fuel' | 'weights' | 'weather';

interface Tab {
  id: TabId;
  icon: React.ReactNode;
  label: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Route', icon: <Route className="h-4 w-4" /> },
  { id: 'fuel', label: 'Fuel', icon: <Fuel className="h-4 w-4" /> },
  { id: 'weights', label: 'Weight', icon: <Scale className="h-4 w-4" /> },
  { id: 'weather', label: 'WX', icon: <Cloud className="h-4 w-4" /> },
];

export default function FlightInfoPanel() {
  const simbriefData = useFlightPlanStore((s) => s.simbriefData);
  const clearFlightPlan = useFlightPlanStore((s) => s.clearFlightPlan);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (!simbriefData) {
    return null;
  }

  const apiUnit = simbriefData.params.units;
  const flightNumber = simbriefData.general.icao_airline
    ? `${simbriefData.general.icao_airline}${simbriefData.general.flight_number}`
    : simbriefData.atc.callsign;

  return (
    <div
      className={cn(
        'absolute left-4 z-30 transition-all duration-300 ease-out',
        isCollapsed
          ? 'top-28 w-12' // Position below toolbar when collapsed
          : 'top-1/2 w-80 -translate-y-1/2' // Vertically centered when expanded
      )}
    >
      <div
        className={cn(
          'relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/95 shadow-xl backdrop-blur-sm transition-all duration-300',
          isCollapsed ? 'h-44' : 'max-h-[calc(100vh-120px)]'
        )}
      >
        {/* Collapsed state */}
        <div
          className={cn(
            'absolute inset-0 z-20 flex flex-col items-center bg-card/95 py-5 transition-opacity duration-200',
            isCollapsed ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="mb-4 h-8 w-8"
            onClick={() => setIsCollapsed(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span
            className="font-mono text-sm font-bold tracking-wider text-foreground"
            style={{ writingMode: 'vertical-rl' }}
          >
            {flightNumber}
          </span>
        </div>

        {/* Control Buttons */}
        <div
          className={cn(
            'flex items-center justify-end border-b border-border/30 px-1 py-1',
            isCollapsed && 'opacity-0'
          )}
        >
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/40 hover:text-foreground"
              onClick={() => setIsCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={clearFlightPlan}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className={cn('border-b border-border/30 px-4 pb-3 pt-3', isCollapsed && 'opacity-0')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SimbriefLogo size="xs" className="opacity-70" />
              <Badge variant="secondary" className="font-mono text-xs font-bold">
                {flightNumber}
              </Badge>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-muted-foreground">
                {simbriefData.aircraft.icao_code}
              </span>
            </div>
          </div>

          {/* Route Display */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="text-center">
              <p className="font-mono text-lg font-bold tracking-tight text-foreground">
                {simbriefData.origin.icao_code}
              </p>
              <p className="text-[10px] text-muted-foreground">
                RWY {simbriefData.origin.plan_rwy}
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-border" />
                <Plane className="h-3.5 w-3.5 rotate-90 text-primary" />
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-border" />
              </div>
              <span className="font-mono text-[9px] text-muted-foreground">
                {formatDistance(simbriefData.general.air_distance)}
              </span>
            </div>
            <div className="text-center">
              <p className="font-mono text-lg font-bold tracking-tight text-foreground">
                {simbriefData.destination.icao_code}
              </p>
              <p className="text-[10px] text-muted-foreground">
                RWY {simbriefData.destination.plan_rwy}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={cn('flex border-b border-border/30', isCollapsed && 'opacity-0')}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <ScrollArea className={cn('flex-1', isCollapsed && 'opacity-0')}>
          <div className="p-3">
            {activeTab === 'overview' && <OverviewTab data={simbriefData} apiUnit={apiUnit} />}
            {activeTab === 'fuel' && <FuelTab data={simbriefData} apiUnit={apiUnit} />}
            {activeTab === 'weights' && <WeightsTab data={simbriefData} apiUnit={apiUnit} />}
            {activeTab === 'weather' && <WeatherTab data={simbriefData} />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  return (
    <div className="space-y-3">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="ETE" value={formatFlightTime(data.times.est_time_enroute)} />
        <StatBox label="FL" value={data.general.initial_altitude} />
        <StatBox label="CI" value={data.general.costindex} />
        <StatBox label="AIRAC" value={data.general.airac} />
      </div>

      {/* Wind */}
      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
        <span className="text-sm text-muted-foreground">Avg Wind</span>
        <span className="font-mono text-sm font-medium">
          {data.general.avg_wind_dir}°/{data.general.avg_wind_spd}kt
        </span>
      </div>

      {/* Fuel Summary */}
      <div className="rounded-lg bg-muted/40 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Block Fuel</span>
          <span className="font-mono font-medium">{formatFuel(data.fuel.plan_ramp, apiUnit)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Landing</span>
          <span className="font-mono font-medium text-success">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </span>
        </div>
      </div>

      {/* Weights Summary */}
      <div className="rounded-lg bg-muted/40 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">TOW</span>
          <span className="font-mono font-medium">
            {formatWeight(data.weights.est_tow, apiUnit)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">PAX / Cargo</span>
          <span className="font-mono font-medium">
            {data.weights.pax_count} / {formatWeight(data.weights.cargo, apiUnit)}
          </span>
        </div>
      </div>

      {/* Alternate */}
      {data.alternate && (
        <div className="flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2">
          <span className="text-sm text-warning/70">Alternate</span>
          <span className="font-mono text-sm font-medium text-warning">
            {data.alternate.icao_code}
          </span>
        </div>
      )}

      {/* PDF Link */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-full justify-center text-[10px] text-muted-foreground"
        onClick={() => window.appAPI.openExternal(data.files.pdf.link)}
      >
        View Full OFP (PDF)
      </Button>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="font-mono text-sm font-medium">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// Fuel Tab
function FuelTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const totalFuel = parseInt(data.fuel.plan_ramp, 10);
  const fuelItems = [
    { label: 'Taxi', value: data.fuel.taxi, color: 'bg-muted-foreground' },
    { label: 'Trip', value: data.fuel.enroute_burn, color: 'bg-primary' },
    { label: 'Contingency', value: data.fuel.contingency, color: 'bg-warning' },
    { label: 'Alternate', value: data.fuel.alternate_burn, color: 'bg-warning' },
    { label: 'Reserve', value: data.fuel.reserve, color: 'bg-destructive' },
    { label: 'Extra', value: data.fuel.extra, color: 'bg-success' },
  ];

  return (
    <div className="space-y-3">
      {/* Fuel Breakdown */}
      {fuelItems.map((item) => {
        const amount = parseInt(item.value, 10);
        const percentage = (amount / totalFuel) * 100;
        if (amount === 0) return null;
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', item.color)} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-mono font-medium">{formatFuel(item.value, apiUnit)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full transition-all', item.color)}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}

      <Separator className="my-3" />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-primary/10 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Block</p>
          <p className="font-mono text-sm font-bold text-primary">
            {formatFuel(data.fuel.plan_ramp, apiUnit)}
          </p>
        </div>
        <div className="rounded-lg bg-success/10 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Landing</p>
          <p className="font-mono text-sm font-bold text-success">
            {formatFuel(data.fuel.plan_landing, apiUnit)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Weights Tab
function WeightsTab({ data, apiUnit }: { data: SimBriefOFP; apiUnit: string }) {
  const weights = [
    {
      label: 'ZFW',
      est: parseInt(data.weights.est_zfw, 10),
      max: parseInt(data.weights.max_zfw, 10),
    },
    {
      label: 'TOW',
      est: parseInt(data.weights.est_tow, 10),
      max: parseInt(data.weights.max_tow, 10),
    },
    {
      label: 'LDW',
      est: parseInt(data.weights.est_ldw, 10),
      max: parseInt(data.weights.max_ldw, 10),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Weight Gauges */}
      {weights.map((w) => {
        const percentage = (w.est / w.max) * 100;
        const isWarning = percentage > 95;
        const isCritical = percentage > 100;
        return (
          <div key={w.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono font-medium text-muted-foreground">{w.label}</span>
              <div>
                <span
                  className={cn(
                    'font-mono font-medium',
                    isCritical && 'text-destructive',
                    isWarning && !isCritical && 'text-warning'
                  )}
                >
                  {formatWeight(w.est.toString(), apiUnit)}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  / {formatWeight(w.max.toString(), apiUnit)}
                </span>
              </div>
            </div>
            <Progress
              value={Math.min(percentage, 100)}
              className={cn(
                'h-2',
                isCritical && '[&>div]:bg-destructive',
                isWarning && !isCritical && '[&>div]:bg-warning'
              )}
            />
            <p className="text-right text-[9px] text-muted-foreground">{percentage.toFixed(1)}%</p>
          </div>
        );
      })}

      <Separator className="my-3" />

      {/* Payload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">OEW</span>
          <span className="font-mono font-medium">{formatWeight(data.weights.oew, apiUnit)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Passengers</span>
          <span className="font-mono font-medium">{data.weights.pax_count}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Cargo</span>
          <span className="font-mono font-medium">{formatWeight(data.weights.cargo, apiUnit)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Payload</span>
          <span className="font-mono font-medium">
            {formatWeight(data.weights.payload, apiUnit)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Weather Tab
function WeatherTab({ data }: { data: SimBriefOFP }) {
  const originMetar = useMemo(() => {
    if (!data.origin.metar) return null;
    try {
      return parseMetar(data.origin.metar);
    } catch {
      return null;
    }
  }, [data.origin.metar]);

  const destMetar = useMemo(() => {
    if (!data.destination.metar) return null;
    try {
      return parseMetar(data.destination.metar);
    } catch {
      return null;
    }
  }, [data.destination.metar]);

  return (
    <div className="space-y-3">
      {/* Origin */}
      <WeatherCard
        icao={data.origin.icao_code}
        icon={PlaneTakeoff}
        metar={originMetar}
        rawMetar={data.origin.metar}
      />

      {/* Destination */}
      <WeatherCard
        icao={data.destination.icao_code}
        icon={PlaneLanding}
        metar={destMetar}
        rawMetar={data.destination.metar}
      />

      {/* Alternate */}
      {data.alternate && (
        <div className="rounded-lg bg-warning/10 p-2">
          <div className="flex items-center gap-2 text-sm text-warning">
            <Route className="h-3 w-3" />
            <span className="font-mono font-medium">{data.alternate.icao_code}</span>
            <span className="text-warning/70">Alternate</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WeatherCard({
  icao,
  icon: Icon,
  metar,
  rawMetar,
}: {
  icao: string;
  icon: typeof PlaneTakeoff;
  metar: IMetar | null;
  rawMetar: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-sm font-medium">{icao}</span>
      </div>

      {metar && (
        <div className="mb-2 grid grid-cols-4 gap-1 text-center">
          <div>
            <p className="font-mono text-[10px] font-medium">{formatWind(metar.wind)}</p>
            <p className="text-[8px] text-muted-foreground">Wind</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium">
              {formatVisibility(metar.visibility, metar.cavok)}
            </p>
            <p className="text-[8px] text-muted-foreground">Vis</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium">{metar.temperature ?? '—'}°</p>
            <p className="text-[8px] text-muted-foreground">Temp</p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-medium">{formatAltimeter(metar.altimeter)}</p>
            <p className="text-[8px] text-muted-foreground">QNH</p>
          </div>
        </div>
      )}

      <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
        {rawMetar || 'No METAR'}
      </p>
    </div>
  );
}

// METAR formatting helpers
function formatWind(wind: IWind | undefined): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'CALM';
  const dir = wind.degrees !== undefined ? `${String(wind.degrees).padStart(3, '0')}°` : 'VRB';
  const gust = wind.gust ? `G${wind.gust}` : '';
  return `${dir}/${wind.speed}${gust}`;
}

function formatVisibility(vis: Visibility | undefined, cavok?: true): string {
  if (cavok) return 'CAVOK';
  if (!vis) return '—';
  if (vis.unit === DistanceUnit.StatuteMiles) {
    if (vis.value >= 10) return '>10SM';
    return `${vis.value}SM`;
  }
  if (vis.value >= 9999) return '>10km';
  return `${(vis.value / 1000).toFixed(1)}km`;
}

function formatAltimeter(alt: IAltimeter | undefined): string {
  if (!alt) return '—';
  if (alt.unit === 'inHg') return `${alt.value.toFixed(2)}"`;
  return `${alt.value}`;
}
