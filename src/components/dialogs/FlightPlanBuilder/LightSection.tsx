import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import tzlookup from 'tz-lookup';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import {
  LIGHT_GOALS,
  type LightGoal,
  type LightPhase,
  type RoutePoint,
  phaseAt,
  routePointAt,
  sampleRoute,
  solveTakeoff,
} from '@/lib/solar/phase';
import { cn } from '@/lib/utils/helpers';
import { useLaunchStore } from '@/stores/launchStore';
import { useSolarStore } from '@/stores/solarStore';

const SAMPLES = 40;
const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Three steps are enough to answer "is it light": the twilight bands collapse into one. */
type Light = 'day' | 'twilight' | 'night';

const LIGHT_CLASS: Record<Light, string> = {
  day: 'bg-warning',
  twilight: 'bg-info/40',
  night: 'bg-background',
};

function toLight(phase: LightPhase): Light {
  if (phase === 'day') return 'day';
  if (phase === 'night') return 'night';
  return 'twilight';
}

function safeTz(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

function formatInZone(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    hour12: false,
  });
}

function dateInZone(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone });
}

function hoursInZone(ms: number, timeZone: string): number {
  const [h, m] = formatInZone(ms, timeZone).split(':').map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

/** Same calendar day as `baseMs` in the zone, at the given local clock hours. */
function atLocalHours(baseMs: number, timeZone: string, hours: number): number {
  return baseMs + (hours - hoursInZone(baseMs, timeZone)) * HOUR_MS;
}

function minuteNow(): number {
  return Math.floor(Date.now() / MIN_MS) * MIN_MS;
}

interface Props {
  departure: PlanEndpoint;
  arrival: PlanEndpoint;
  /** Departure, en-route fixes and arrival, in flying order. */
  routePoints: RoutePoint[];
  eteMinutes: number;
}

export function LightSection({ departure, arrival, routePoints, eteMinutes }: Props) {
  const { t } = useTranslation();
  const timeOfDay = useLaunchStore((s) => s.timeOfDay);
  const useRealWorldTime = useLaunchStore((s) => s.useRealWorldTime);
  const setPreview = useSolarStore((s) => s.setPreview);

  const depTz = useMemo(
    () => safeTz(departure.latitude, departure.longitude),
    [departure.latitude, departure.longitude]
  );
  const arrTz = useMemo(
    () => safeTz(arrival.latitude, arrival.longitude),
    [arrival.latitude, arrival.longitude]
  );

  const [open, setOpen] = useState(true);
  const [nowMs, setNowMs] = useState(minuteNow);
  // Start from what the launcher would use, so the two screens agree.
  const [takeoffMs, setTakeoffMs] = useState(() =>
    useRealWorldTime ? minuteNow() : atLocalHours(minuteNow(), depTz, timeOfDay)
  );

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(minuteNow()), MIN_MS);
    return () => window.clearInterval(id);
  }, []);

  const landingMs = takeoffMs + eteMinutes * MIN_MS;
  const depLight = toLight(phaseAt(takeoffMs, departure.latitude, departure.longitude));
  const arrLight = toLight(phaseAt(landingMs, arrival.latitude, arrival.longitude));

  const bands = useMemo(
    () => sampleRoute(routePoints, takeoffMs, landingMs, SAMPLES).map(toLight),
    [routePoints, takeoffMs, landingMs]
  );

  const goals = useMemo(() => {
    const out = {} as Record<LightGoal, number | null>;
    for (const goal of LIGHT_GOALS) {
      out[goal] = solveTakeoff(goal, { points: routePoints, eteMinutes, fromMs: nowMs });
    }
    return out;
  }, [routePoints, eteMinutes, nowMs]);
  const activeGoal = LIGHT_GOALS.find((goal) => goals[goal] === takeoffMs) ?? '';

  const onTimeInput = (value: string) => {
    const match = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
    if (!match) return;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return;
    setTakeoffMs(atLocalHours(takeoffMs, depTz, h + m / 60));
  };

  // Hovering the band scrubs through the flight (0 is takeoff, 1 is landing);
  // a click pins the position so it survives the mouse leaving, and a click
  // on the pin lets go. With nothing pinned the map shows the moment the
  // chosen goal is about: landing for the landing goals, takeoff otherwise.
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const scrub = hover ?? pinned;
  const restMs =
    activeGoal === 'dawnArrival' || activeGoal === 'duskArrival' ? landingMs : takeoffMs;
  const scrubMs = scrub === null ? null : takeoffMs + scrub * eteMinutes * MIN_MS;
  const previewMs = scrubMs ?? restMs;
  const scrubLabel = useMemo(() => {
    if (scrub === null || scrubMs === null) return null;
    const { latitude, longitude } = routePointAt(routePoints, scrub);
    return t('planBuilder.light.scrubLabel', {
      time: formatInZone(scrubMs, 'UTC'),
      phase: t(`planBuilder.light.phase.${toLight(phaseAt(scrubMs, latitude, longitude))}`),
    });
  }, [scrub, scrubMs, routePoints, t]);
  const isTomorrow = dateInZone(takeoffMs, depTz) !== dateInZone(nowMs, depTz);

  const fractionAt = (e: React.MouseEvent<HTMLDivElement>): number | null => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    if (width <= 0) return null;
    return Math.min(1, Math.max(0, (e.clientX - left) / width));
  };

  // Light the map for the moment being previewed, and hand it back to the
  // live clock when the section goes away.
  useEffect(() => {
    setPreview(open ? previewMs : null);
  }, [open, previewMs, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="space-y-3">
        <CollapsibleTrigger className="group xp-section-heading hover:text-foreground flex w-full items-center gap-1 text-left transition-colors">
          {t('planBuilder.sections.light')}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="bg-secondary/40 space-y-3 p-3">
            <div className="flex items-center gap-2">
              <span className="xp-label shrink-0">{t('planBuilder.light.takeoff')}</span>
              <TimeInput value={formatInZone(takeoffMs, depTz)} onCommit={onTimeInput} />
              {isTomorrow && (
                <span className="text-muted-foreground truncate text-xs">
                  {t('planBuilder.light.tomorrow')}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTakeoffMs(nowMs)}
                disabled={takeoffMs === nowMs}
              >
                {t('planBuilder.light.now')}
              </Button>
              <div className="flex-1" />
              <Select
                value={activeGoal}
                onValueChange={(goal) => {
                  const solved = goals[goal as LightGoal];
                  if (solved !== null && solved !== undefined) setTakeoffMs(solved);
                }}
              >
                <SelectTrigger className="h-7 w-auto min-w-0 gap-1 text-xs">
                  <SelectValue placeholder={t('planBuilder.light.planFor')} />
                </SelectTrigger>
                <SelectContent align="end">
                  {LIGHT_GOALS.map((goal) => (
                    <SelectItem key={goal} value={goal} disabled={goals[goal] === null}>
                      {t(`planBuilder.light.goal.${goal}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Endpoint
                icao={departure.icao}
                time={formatInZone(takeoffMs, depTz)}
                light={depLight}
              />
              <div
                className="relative min-w-0 flex-1 cursor-crosshair py-1"
                onMouseMove={(e) => setHover(fractionAt(e))}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  const f = fractionAt(e);
                  if (f === null) return;
                  // Clicking on the pin releases it; anywhere else moves it.
                  setPinned(pinned !== null && Math.abs(f - pinned) < 0.02 ? null : f);
                }}
              >
                <div className="border-border flex h-3 overflow-hidden rounded-sm border">
                  {bands.map((light, i) => (
                    <div key={i} className={cn('flex-1', LIGHT_CLASS[light])} />
                  ))}
                </div>
                {scrub !== null && (
                  <div
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute top-0 bottom-0 w-px',
                      hover === null ? 'bg-primary' : 'bg-foreground'
                    )}
                    style={{ left: `${scrub * 100}%` }}
                  />
                )}
                {scrub !== null && scrubLabel && (
                  <div
                    aria-hidden
                    className="bg-popover text-popover-foreground border-border pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 rounded-sm border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap tabular-nums"
                    style={{ left: `${scrub * 100}%` }}
                  >
                    {scrubLabel}
                  </div>
                )}
              </div>
              <Endpoint
                icao={arrival.icao}
                time={formatInZone(landingMs, arrTz)}
                light={arrLight}
                align="right"
              />
            </div>
          </Card>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function Endpoint({
  icao,
  time,
  light,
  align = 'left',
}: {
  icao: string;
  /** Local clock time at this end of the flight. */
  time: string;
  light: Light;
  align?: 'left' | 'right';
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex shrink-0 flex-col leading-tight', align === 'right' && 'text-right')}>
      <span className="xp-value font-semibold">{icao}</span>
      <span className="text-muted-foreground font-mono text-xs tabular-nums">{time}</span>
      <span className="text-muted-foreground text-xs">{t(`planBuilder.light.phase.${light}`)}</span>
    </div>
  );
}

/** 24-hour clock field: type HH:mm, Enter or blur applies, Escape reverts. */
function TimeInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <Input
      value={draft ?? value}
      inputMode="numeric"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="h-7 w-16 font-mono text-xs tabular-nums"
    />
  );
}
