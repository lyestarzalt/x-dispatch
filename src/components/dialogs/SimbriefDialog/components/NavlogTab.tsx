import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOfpUnits } from '@/hooks/useOfpUnits';
import { parseDurationSeconds, parseTimestamp } from '@/lib/simbrief/ofp';
import type { Feet, NauticalMiles } from '@/lib/utils/geomath';
import { cn } from '@/lib/utils/helpers';
import type { Knots } from '@/lib/utils/units';
import { useSettingsStore } from '@/stores/settingsStore';
import type { SimBriefFix, SimBriefOFP } from '@/types/simbrief';

interface NavlogTabProps {
  data: SimBriefOFP;
  apiUnit: string;
  /** The fix under the cursor on the profile chart, lit up in the table. */
  highlightIdent?: string | null;
}

export function NavlogTab({ data, apiUnit, highlightIdent }: NavlogTabProps) {
  const { t } = useTranslation();
  const units = useOfpUnits(apiUnit);
  const weightUnit = useSettingsStore((s) => s.map.units.weight);
  const [expandedFix, setExpandedFix] = useState<string | null>(null);

  const fixes = data.navlog;

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

  // With the planned off-block time the column is a clock ETA; without it, time since takeoff.
  const offBlock = parseTimestamp(data.times.est_off);
  const formatTime = (duration: string) => {
    const totalSec = parseDurationSeconds(duration);
    if (totalSec === null) return '—';
    if (offBlock) {
      return new Date(offBlock.getTime() + totalSec * 1000).toISOString().slice(11, 16) + 'Z';
    }
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Fuel on board in the user's unit, as thousands so it fits the column: "9.2k" or "4.2t".
  const formatFuel = (value: string) => {
    const amount = units.ofpWeightF(value);
    if (amount === null) return '—';
    const thousands = amount / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}${weightUnit === 'kg' ? 't' : 'k'}`;
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
    <div className="bg-card flex min-h-0 flex-1 flex-col rounded-lg border">
      {/* Header */}
      <div className="bg-card text-muted-foreground text-2xs grid grid-cols-[1fr_80px_80px_100px_80px_80px_60px] gap-2 border-b px-4 py-2 font-medium tracking-wider uppercase">
        <div>{t('simbriefDialog.navlog.colFix')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colAltitude')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colWind')}</div>
        <div className="text-right">{t('simbriefDialog.navlog.colGsMach')}</div>
        <div className="text-right">
          {offBlock ? t('simbriefDialog.navlog.colEta') : t('simbriefDialog.navlog.colElapsed')}
        </div>
        <div className="text-right">{t('simbriefDialog.navlog.colFuelRem')}</div>
        <div></div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-border/50 divide-y">
          {processedFixes.map((fix) => (
            <NavlogRow
              key={`${fix.ident}-${fix.index}`}
              fix={fix}
              apiUnit={apiUnit}
              formatTime={formatTime}
              formatFuel={formatFuel}
              getStageColor={getStageColor}
              highlighted={highlightIdent === fix.ident}
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
      <div className="bg-muted/30 flex items-center justify-between border-t px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          {t('simbriefDialog.navlog.waypointCount', { count: fixes.length })}
        </span>
        <span className="text-muted-foreground">
          {t('simbriefDialog.profile.total')}{' '}
          {t('simbriefDialog.profile.distanceNm', {
            value: units.distance(
              (processedFixes[processedFixes.length - 1]?.cumulativeDistance || 0) as NauticalMiles
            ),
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
  highlighted: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function NavlogRow({
  fix,
  apiUnit,
  formatTime,
  formatFuel,
  getStageColor,
  highlighted,
  isExpanded,
  onToggle,
}: NavlogRowProps) {
  const { t } = useTranslation();
  const units = useOfpUnits(apiUnit);
  const rowRef = useRef<HTMLDivElement>(null);
  // Hovering the profile chart lights this row up; bring it into view without moving the chart,
  // which sits outside this list's own scroll area.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlighted]);
  const windDir = parseInt(fix.wind_dir, 10);
  const windSpd = parseInt(fix.wind_spd, 10);
  const windComp = parseInt(fix.wind_component, 10);

  // Determine if headwind or tailwind
  const isHeadwind = windComp < 0;

  return (
    <div ref={rowRef}>
      <div
        className={cn(
          'hover:bg-muted/30 grid grid-cols-[1fr_80px_80px_100px_80px_80px_60px] gap-2 px-4 py-2 transition-colors',
          (fix.isTopOfClimb || fix.isTopOfDescent) && 'bg-muted/20',
          highlighted && 'bg-primary/10'
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
                <Badge variant="success" className="text-2xs">
                  {t('simbriefDialog.profile.tocBadge')}
                </Badge>
              )}
              {fix.isTopOfDescent && (
                <Badge variant="warning" className="text-2xs">
                  {t('simbriefDialog.profile.todBadge')}
                </Badge>
              )}
            </div>
            {fix.via_airway && (
              <span className="text-muted-foreground text-2xs">{fix.via_airway}</span>
            )}
          </div>
        </div>

        {/* Altitude */}
        <div className="flex items-center justify-end">
          <span className="font-mono text-sm">
            {parseInt(fix.altitude_feet, 10) >= 10000
              ? `FL${Math.round(parseInt(fix.altitude_feet, 10) / 100)}`
              : units.altitude(parseInt(fix.altitude_feet, 10) as Feet)}
          </span>
        </div>

        {/* Wind */}
        <div className="flex items-center justify-end gap-1">
          <Wind
            className="text-muted-foreground h-3 w-3"
            style={{ transform: `rotate(${windDir}deg)` }}
          />
          <span className="text-muted-foreground font-mono text-sm">
            {windDir.toString().padStart(3, '0')}/{windSpd}
          </span>
        </div>

        {/* GS / Mach */}
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm">{units.speed(Number(fix.groundspeed) as Knots)}</span>
          <span className="text-muted-foreground text-2xs font-mono">
            {t('simbriefDialog.performance.machValue', {
              mach: (Number(fix.mach_thousandths) || Number(fix.mach) || 0).toFixed(2),
            })}
          </span>
        </div>

        {/* ETA */}
        <div className="flex items-center justify-end">
          <span className="font-mono text-sm">{formatTime(fix.time_total)}</span>
        </div>

        {/* Fuel Remaining */}
        <div className="flex items-center justify-end">
          <span className="font-mono text-sm">{formatFuel(fix.fuel_plan_onboard)}</span>
        </div>

        {/* Expand button */}
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="icon-xs" onClick={onToggle}>
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-muted/20 grid grid-cols-4 gap-4 border-t border-dashed px-4 py-3 text-sm">
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
                value: `${isHeadwind ? '' : '+'}${Math.round(windComp)} ${t('units.kt')}`,
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
            <p className="font-mono">{units.altitude(parseInt(fix.ground_height, 10) as Feet)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.mora')}</p>
            <p className="font-mono">{fix.mora ? units.altitude(Number(fix.mora) as Feet) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('simbriefDialog.navlog.fuelUsed')}</p>
            <p className="font-mono">{units.ofpWeight(fix.fuel_totalused)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
