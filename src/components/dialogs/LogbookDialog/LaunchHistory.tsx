import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Copy,
  Fuel,
  Globe,
  History,
  Plane,
  Sun,
  Trash2,
  Weight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import { useAircraftImage } from '@/queries';
import { useAircraftList } from '@/queries/useLaunchQuery';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import type { LogbookEntry } from '../LaunchDialog/types';

const WEATHER_ICONS: Record<string, typeof Sun> = {
  real: Globe,
  clear: Sun,
  cloudy: CloudSun,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: CloudSnow,
  foggy: CloudFog,
};

const WEATHER_GRADIENTS: Record<string, string> = {
  clear: 'from-sky-500/15 via-sky-500/5 to-transparent',
  cloudy: 'from-slate-400/15 via-slate-400/5 to-transparent',
  rainy: 'from-slate-600/15 via-slate-600/5 to-transparent',
  stormy: 'from-purple-900/15 via-purple-900/5 to-transparent',
  snowy: 'from-white/10 via-white/5 to-transparent',
  foggy: 'from-gray-300/10 via-gray-300/5 to-transparent',
  real: 'from-neutral-400/10 via-neutral-400/5 to-transparent',
  custom: 'from-teal-500/15 via-teal-500/5 to-transparent',
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

function getWeatherGradientKey(entry: LogbookEntry): string {
  if (entry.weatherMode === 'real') return 'real';
  if (entry.weatherMode === 'custom') return 'custom';
  return entry.weatherPreset || 'clear';
}

function getWeatherLabel(entry: LogbookEntry): string {
  if (entry.weatherMode === 'real') return 'Live';
  if (entry.weatherMode === 'custom') return 'Custom';
  return entry.weatherPreset.charAt(0).toUpperCase() + entry.weatherPreset.slice(1);
}

function formatFuelSummary(percentages: number[]): string {
  if (percentages.length === 0) return '—';
  const avg = Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length);
  return `${avg}%`;
}

function formatPayloadSummary(weights: number[]): string {
  const total = weights.reduce((s, v) => s + v, 0);
  if (total === 0) return 'Empty';
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k lbs`;
  return `${Math.round(total)} lbs`;
}

function formatTimeOfDay(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}L`;
}

/** Recent launch setups, restorable into the launch dialog. */
export function LaunchHistory() {
  const { t } = useTranslation();
  const logbook = useLaunchStore((s) => s.logbook);
  const removeLogbookEntry = useLaunchStore((s) => s.removeLogbookEntry);
  const clearLogbook = useLaunchStore((s) => s.clearLogbook);
  const { data: aircraftList = [] } = useAircraftList();

  const handleRestore = (entry: LogbookEntry) => {
    const {
      selectAircraft,
      setSelectedLivery,
      setWeatherConfig,
      setTimeOfDay,
      setUseRealWorldTime,
      setColdAndDark,
    } = useLaunchStore.getState();

    const aircraft = aircraftList.find((a) => a.path === entry.aircraftPath);
    if (aircraft) {
      selectAircraft(aircraft);
      if (aircraft.liveries.some((l) => l.name === entry.livery)) {
        setSelectedLivery(entry.livery);
      }
      const expectedTanks = (aircraft.tankNames ?? []).length;
      if (entry.tankPercentages.length === expectedTanks) {
        useLaunchStore.setState({ tankPercentages: entry.tankPercentages });
      }
      const expectedPayload = (aircraft.payloadStations ?? []).length;
      if (entry.payloadWeights.length === expectedPayload) {
        useLaunchStore.setState({ payloadWeights: entry.payloadWeights });
      }
    }

    setWeatherConfig(entry.weatherConfig);
    setTimeOfDay(entry.timeOfDay);
    setUseRealWorldTime(entry.useRealWorldTime);
    setColdAndDark(entry.coldAndDark);
    const app = useAppStore.getState();
    app.setStartPosition(entry.startPosition);
    app.closeLogbook();
    app.setShowLaunchDialog(true);
  };

  return (
    <div className="flex h-full flex-col">
      {logbook.length > 0 && (
        <div className="border-border/40 flex flex-shrink-0 items-center justify-end border-b px-4 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLogbook}
            className="text-destructive hover:text-destructive h-7 text-xs"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t('launcher.logbook.clearAll')}
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1">
        {logbook.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
            <History className="text-muted-foreground/40 h-10 w-10" />
            <p className="text-muted-foreground text-sm">{t('launcher.logbook.empty')}</p>
            <p className="text-muted-foreground/60 text-xs">{t('launcher.logbook.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="border-border/40 bg-muted/20 border-b px-4 py-2">
              <p className="text-muted-foreground text-xs">{t('launcher.logbook.shareHint')}</p>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {logbook.map((entry) => (
                <LogbookCard
                  key={entry.id}
                  entry={entry}
                  onRestore={handleRestore}
                  onDelete={removeLogbookEntry}
                />
              ))}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
}

interface LogbookCardProps {
  entry: LogbookEntry;
  onRestore: (entry: LogbookEntry) => void;
  onDelete: (id: string) => void;
}

function LogbookCard({ entry, onRestore, onDelete }: LogbookCardProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const { data: previewImage } = useAircraftImage(entry.previewImagePath);

  const handleCopyJson = async () => {
    await window.appAPI.clipboardWrite(JSON.stringify(entry.flightInit, null, 2));
    toast.success(t('launcher.logbook.copyJsonToast'));
  };
  const gradientKey = getWeatherGradientKey(entry);
  const gradient = WEATHER_GRADIENTS[gradientKey] || WEATHER_GRADIENTS.clear;
  const WeatherIcon =
    WEATHER_ICONS[entry.weatherMode === 'preset' ? entry.weatherPreset : entry.weatherMode] || Sun;
  const isCustomPosition = entry.positionType === 'custom';

  return (
    <button
      type="button"
      className="group border-border/50 bg-card/90 hover:border-primary/40 relative flex items-stretch overflow-hidden rounded-xl border text-left transition-colors"
      onClick={() => onRestore(entry)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Aircraft image ────────────────────────────────── */}
      <div
        className={cn(
          'relative flex w-40 shrink-0 items-center justify-center self-stretch bg-gradient-to-br',
          gradient
        )}
      >
        {previewImage ? (
          <img
            src={previewImage}
            alt={entry.aircraftName}
            className="h-full w-full object-contain p-1.5 drop-shadow-lg"
          />
        ) : (
          <Plane className="text-muted-foreground/8 h-12 w-12" />
        )}
        <div className="to-card/90 absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent" />
      </div>

      {/* ── Aircraft identity + flight config ─────────────── */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-2.5 pr-3 pl-2">
        {/* Row 1: Aircraft name + ICAO badge */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-foreground truncate text-sm font-semibold">
              {entry.aircraftName}
            </span>
            {entry.aircraftICAO && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                {entry.aircraftICAO}
              </Badge>
            )}
          </div>
          {entry.livery !== 'Default' && (
            <span className="text-muted-foreground block truncate text-xs">{entry.livery}</span>
          )}
        </div>

        {/* Row 2: Metadata as icon·value pairs (AircraftPreview dot-separator pattern) */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <WeatherIcon className="h-3 w-3 shrink-0" />
          <span>{getWeatherLabel(entry)}</span>
          <span className="text-border">·</span>
          <Fuel className="h-3 w-3 shrink-0" />
          <span className="font-mono">{formatFuelSummary(entry.tankPercentages)}</span>
          <span className="text-border">·</span>
          <Weight className="h-3 w-3 shrink-0" />
          <span className="font-mono">{formatPayloadSummary(entry.payloadWeights)}</span>
          <span className="text-border">·</span>
          <Clock className="h-3 w-3 shrink-0" />
          <span className="font-mono">
            {entry.useRealWorldTime
              ? t('launcher.logbook.timeLive')
              : formatTimeOfDay(entry.timeOfDay)}
          </span>
          <span className="text-border">·</span>
          <span>
            {entry.coldAndDark ? t('launcher.logbook.coldAndDark') : t('launcher.logbook.ready')}
          </span>
        </div>
      </div>

      {/* ── Separator ─────────────────────────────────────── */}
      <div className="bg-border/30 h-auto w-px self-stretch" />

      {/* ── Location ──────────────────────────────────────── */}
      <div className="flex w-48 shrink-0 flex-col items-end justify-center px-4 pt-2 pb-7">
        {isCustomPosition ? (
          <span className="text-foreground font-mono text-sm leading-tight font-bold">
            {entry.startPosition.latitude >= 0 ? 'N' : 'S'}
            {Math.abs(entry.startPosition.latitude).toFixed(3)}°{' '}
            {entry.startPosition.longitude >= 0 ? 'E' : 'W'}
            {Math.abs(entry.startPosition.longitude).toFixed(3)}°
          </span>
        ) : (
          <>
            <span className="text-foreground font-mono text-lg leading-none font-bold">
              {entry.airportICAO}
            </span>
            {entry.airportName && (
              <span className="text-muted-foreground mt-0.5 max-w-full truncate text-right text-xs">
                {entry.airportName}
              </span>
            )}
            <span className="text-primary mt-1 font-mono text-sm font-medium">
              {entry.positionType === 'runway' ? `RWY ${entry.positionName}` : entry.positionName}
            </span>
          </>
        )}
      </div>

      {/* ── Bottom-right cluster: timestamp + actions ─────── */}
      <div className="absolute right-2 bottom-1.5 z-10 flex items-center gap-1.5">
        <span className="text-muted-foreground/40 font-mono text-[10px]">
          {formatRelativeTime(entry.launchedAt)}
        </span>
        <button
          type="button"
          className="text-muted-foreground/60 hover:bg-secondary hover:text-foreground flex h-5 w-5 items-center justify-center rounded"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyJson();
          }}
          title={t('launcher.logbook.copyJson')}
          aria-label={t('launcher.logbook.copyJson')}
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          className={cn(
            'text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive flex h-5 w-5 items-center justify-center rounded transition-opacity',
            hovered ? 'opacity-100' : 'opacity-0'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
          aria-label={t('common.delete')}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </button>
  );
}
