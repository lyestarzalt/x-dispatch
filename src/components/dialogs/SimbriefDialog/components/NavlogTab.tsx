import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import type { SimBriefFix, SimBriefOFP } from '@/types/simbrief';

interface NavlogTabProps {
  data: SimBriefOFP;
  apiUnit: string;
}

export function NavlogTab({ data, apiUnit }: NavlogTabProps) {
  const [expandedFix, setExpandedFix] = useState<string | null>(null);

  const fixes = data.navlog.fix;

  // Process fixes to add cumulative data
  const processedFixes = useMemo(() => {
    let cumulativeDistance = 0;

    return fixes.map((fix, index) => {
      cumulativeDistance += parseFloat(fix.distance) || 0;

      // Detect phase transitions
      const nextFix = fixes[index + 1];
      const isTopOfClimb = fix.stage === 'CLB' && nextFix?.stage === 'CRZ';
      const isTopOfDescent = fix.stage === 'CRZ' && nextFix?.stage === 'DSC';

      return {
        ...fix,
        cumulativeDistance,
        isTopOfClimb,
        isTopOfDescent,
        index,
      };
    });
  }, [fixes]);

  const formatTime = (seconds: string) => {
    const totalSec = parseInt(seconds, 10);
    if (isNaN(totalSec)) return '—';
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const formatFuel = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return '—';
    if (apiUnit === 'kgs') {
      return `${Math.round(num / 1000)}t`;
    }
    return `${Math.round(num / 1000)}k`;
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'CLB':
        return 'text-success';
      case 'CRZ':
        return 'text-primary';
      case 'DSC':
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px_80px_100px_80px_80px_60px] gap-2 border-b bg-muted/50 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <div>Fix / Airway</div>
        <div className="text-right">Altitude</div>
        <div className="text-right">Wind</div>
        <div className="text-right">GS / Mach</div>
        <div className="text-right">ETA</div>
        <div className="text-right">Fuel Rem</div>
        <div></div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="h-[400px]">
        <div className="divide-y divide-border/50">
          {processedFixes.map((fix) => (
            <NavlogRow
              key={`${fix.ident}-${fix.index}`}
              fix={fix}
              apiUnit={apiUnit}
              formatTime={formatTime}
              formatFuel={formatFuel}
              getStageColor={getStageColor}
              isExpanded={expandedFix === `${fix.ident}-${fix.index}`}
              onToggle={() =>
                setExpandedFix(
                  expandedFix === `${fix.ident}-${fix.index}` ? null : `${fix.ident}-${fix.index}`
                )
              }
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer summary */}
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
        <span className="text-muted-foreground">{fixes.length} waypoints</span>
        <span className="text-muted-foreground">
          Total: {Math.round(processedFixes[processedFixes.length - 1]?.cumulativeDistance || 0)} nm
        </span>
      </div>
    </div>
  );
}

interface NavlogRowProps {
  fix: SimBriefFix & {
    cumulativeDistance: number;
    isTopOfClimb: boolean;
    isTopOfDescent: boolean;
    index: number;
  };
  apiUnit: string;
  formatTime: (s: string) => string;
  formatFuel: (s: string) => string;
  getStageColor: (s: string) => string;
  isExpanded: boolean;
  onToggle: () => void;
}

function NavlogRow({
  fix,
  apiUnit,
  formatTime,
  formatFuel,
  getStageColor,
  isExpanded,
  onToggle,
}: NavlogRowProps) {
  const windDir = parseInt(fix.wind_dir, 10);
  const windSpd = parseInt(fix.wind_spd, 10);
  const windComp = parseInt(fix.wind_component, 10);

  // Determine if headwind or tailwind
  const isHeadwind = windComp < 0;

  return (
    <div>
      <div
        className={cn(
          'grid grid-cols-[1fr_80px_80px_100px_80px_80px_60px] gap-2 px-4 py-2 transition-colors hover:bg-muted/30',
          (fix.isTopOfClimb || fix.isTopOfDescent) && 'bg-muted/20'
        )}
      >
        {/* Fix / Airway */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={cn('font-mono font-medium', getStageColor(fix.stage))}>
                {fix.ident}
              </span>
              {fix.isTopOfClimb && (
                <Badge variant="success" className="text-[9px]">
                  T/C
                </Badge>
              )}
              {fix.isTopOfDescent && (
                <Badge variant="warning" className="text-[9px]">
                  T/D
                </Badge>
              )}
            </div>
            {fix.via_airway && (
              <span className="text-[10px] text-muted-foreground">{fix.via_airway}</span>
            )}
          </div>
        </div>

        {/* Altitude */}
        <div className="flex items-center justify-end">
          <span className="font-mono text-sm">
            {parseInt(fix.altitude_feet, 10) >= 10000
              ? `FL${Math.round(parseInt(fix.altitude_feet, 10) / 100)}`
              : `${parseInt(fix.altitude_feet, 10).toLocaleString()}`}
          </span>
        </div>

        {/* Wind */}
        <div className="flex items-center justify-end gap-1">
          <Wind
            className="h-3 w-3 text-muted-foreground"
            style={{ transform: `rotate(${windDir}deg)` }}
          />
          <span className="font-mono text-sm text-muted-foreground">
            {windDir.toString().padStart(3, '0')}/{windSpd}
          </span>
        </div>

        {/* GS / Mach */}
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm">{fix.groundspeed} kt</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            M{(parseInt(fix.mach_thousandths, 10) / 1000).toFixed(2)}
          </span>
        </div>

        {/* ETA */}
        <div className="flex items-center justify-end">
          <span className="font-mono text-sm">{formatTime(fix.time_total)}</span>
        </div>

        {/* Fuel Remaining */}
        <div className="flex items-center justify-end">
          <span className="font-mono text-sm text-success">
            {formatFuel(fix.fuel_plan_onboard)}
          </span>
        </div>

        {/* Expand button */}
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="grid grid-cols-4 gap-4 border-t border-dashed bg-muted/20 px-4 py-3 text-sm">
          <div>
            <p className="text-muted-foreground">Position</p>
            <p className="font-mono">
              {parseFloat(fix.pos_lat).toFixed(4)}, {parseFloat(fix.pos_long).toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Temperature</p>
            <p className="font-mono">
              {fix.oat}°C (ISA{parseInt(fix.oat_isa_dev, 10) >= 0 ? '+' : ''}
              {fix.oat_isa_dev})
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Wind Component</p>
            <p className={cn('font-mono', isHeadwind ? 'text-destructive' : 'text-success')}>
              {isHeadwind ? '' : '+'}
              {windComp} kt {isHeadwind ? '(headwind)' : '(tailwind)'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Tropopause</p>
            <p className="font-mono">FL{Math.round(parseInt(fix.tropopause_feet, 10) / 100)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">FIR</p>
            <p className="font-mono">{fix.fir || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ground Elevation</p>
            <p className="font-mono">{parseInt(fix.ground_height, 10).toLocaleString()} ft</p>
          </div>
          <div>
            <p className="text-muted-foreground">MORA</p>
            <p className="font-mono">{fix.mora ? `${fix.mora} ft` : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fuel Used</p>
            <p className="font-mono">
              {parseInt(fix.fuel_totalused, 10).toLocaleString()} {apiUnit}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
