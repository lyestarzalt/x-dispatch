import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [expandedFix, setExpandedFix] = useState<string | null>(null);

  const fixes = data.navlog.fix;

  // Process fixes to add cumulative data. The new react-hooks/immutability
  // rule flags mutation captured by closures (`.map` callback reassigning an
  // outer `let`), so use a plain for-loop where the mutation is direct.
  const processedFixes = useMemo(() => {
    const result: Array<
      (typeof fixes)[number] & {
        cumulativeDistance: number;
        isTopOfClimb: boolean;
        isTopOfDescent: boolean;
        index: number;
      }
    > = [];
    let cumulativeDistance = 0;
    for (let index = 0; index < fixes.length; index++) {
      const fix = fixes[index]!;
      cumulativeDistance += parseFloat(fix.distance) || 0;
      const nextFix = fixes[index + 1];
      const isTopOfClimb = fix.stage === 'CLB' && nextFix?.stage === 'CRZ';
      const isTopOfDescent = fix.stage === 'CRZ' && nextFix?.stage === 'DSC';
      result.push({
        ...fix,
        cumulativeDistance,
        isTopOfClimb,
        isTopOfDescent,
        index,
      });
    }
    return result;
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
        <div>{t('simbriefDialog.navlog.colFix')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colAltitude')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colWind')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colGsMach')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colEta')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colFuelRem')}</div>
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
        <span className="text-muted-foreground">
          {t('simbriefDialog.navlog.waypointCount', { count: fixes.length })}
        </span>
        <span className="text-muted-foreground">
          {t('simbriefDialog.profile.total')}{' '}
          {t('simbriefDialog.profile.distanceNm', {
            value: Math.round(processedFixes[processedFixes.length - 1]?.cumulativeDistance || 0),
          })}
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
  const { t } = useTranslation();
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
                  {t('simbriefDialog.profile.tocBadge')}
                </Badge>
              )}
              {fix.isTopOfDescent && (
                <Badge variant="warning" className="text-[9px]">
                  {t('simbriefDialog.profile.todBadge')}
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
          <span className="font-mono text-sm">
            {t('simbriefDialog.navlog.groundSpeedKt', { value: fix.groundspeed })}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {t('simbriefDialog.performance.machValue', {
              mach: (parseInt(fix.mach_thousandths, 10) / 1000).toFixed(2),
            })}
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
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.position')}</p>
            <p className="font-mono">
              {parseFloat(fix.pos_lat).toFixed(4)}, {parseFloat(fix.pos_long).toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.temperature')}</p>
            <p className="font-mono">
              {t('simbriefDialog.navlog.oatWithIsa', {
                oat: fix.oat,
                sign: parseInt(fix.oat_isa_dev, 10) >= 0 ? '+' : '',
                dev: fix.oat_isa_dev,
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.windComponent')}</p>
            <p className={cn('font-mono', isHeadwind ? 'text-destructive' : 'text-success')}>
              {t('simbriefDialog.navlog.windCompValue', {
                value: `${isHeadwind ? '' : '+'}${windComp}`,
                tag: isHeadwind
                  ? t('simbriefDialog.navlog.headwind')
                  : t('simbriefDialog.navlog.tailwind'),
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.tropopause')}</p>
            <p className="font-mono">
              {t('simbriefDialog.performance.flightLevel', {
                value: Math.round(parseInt(fix.tropopause_feet, 10) / 100),
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.fir')}</p>
            <p className="font-mono">{fix.fir || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.groundElevation')}</p>
            <p className="font-mono">
              {t('simbriefDialog.profile.altitudeFt', {
                value: parseInt(fix.ground_height, 10).toLocaleString(),
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.mora')}</p>
            <p className="font-mono">
              {fix.mora ? t('simbriefDialog.profile.altitudeFt', { value: fix.mora }) : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.fuelUsed')}</p>
            <p className="font-mono">
              {t('simbriefDialog.navlog.fuelUsedValue', {
                value: parseInt(fix.fuel_totalused, 10).toLocaleString(),
                unit: apiUnit,
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
