import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  Clock,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Fuel,
  Globe,
  History,
  MapPin,
  Plane,
  Sun,
  Trash2,
  Weight,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils/helpers';
import { useAircraftImage } from '@/queries';
import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import type { Aircraft } from '@/types/aircraft';
import type { LogbookEntry } from '../types';

interface LogbookDialogProps {
  open: boolean;
  onClose: () => void;
  aircraftList: Aircraft[];
}

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

export function LogbookDialog({ open, onClose, aircraftList }: LogbookDialogProps) {
  const { t } = useTranslation();
  const logbook = useLaunchStore((s) => s.logbook);
  const removeLogbookEntry = useLaunchStore((s) => s.removeLogbookEntry);
  const clearLogbook = useLaunchStore((s) => s.clearLogbook);

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
    useAppStore.getState().setStartPosition(entry.startPosition);

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-6 z-[60] flex flex-col rounded-lg border border-border bg-background shadow-xl"
          aria-describedby={undefined}
        >
          <VisuallyHidden.Root>
            <DialogTitle>{t('launcher.logbook.title')}</DialogTitle>
          </VisuallyHidden.Root>

          {/* Header */}
          <div className="flex h-11 flex-shrink-0 items-center justify-between rounded-t-lg border-b border-border bg-card px-4">
            <div className="flex items-center gap-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('launcher.logbook.title')}</span>
            </div>
            <div className="flex items-center gap-2">
              {logbook.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLogbook}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t('launcher.logbook.clearAll')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                tooltip={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <ScrollArea className="flex-1">
            {logbook.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
                <History className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('launcher.logbook.empty')}</p>
                <p className="text-xs text-muted-foreground/60">
                  {t('launcher.logbook.emptyHint')}
                </p>
              </div>
            ) : (
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
            )}
          </ScrollArea>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

interface LogbookCardProps {
  entry: LogbookEntry;
  onRestore: (entry: LogbookEntry) => void;
  onDelete: (id: string) => void;
}

function LogbookCard({ entry, onRestore, onDelete }: LogbookCardProps) {
  const [hovered, setHovered] = useState(false);
  const { data: previewImage } = useAircraftImage(entry.previewImagePath);
  const gradientKey = getWeatherGradientKey(entry);
  const gradient = WEATHER_GRADIENTS[gradientKey] || WEATHER_GRADIENTS.clear;
  const WeatherIcon =
    WEATHER_ICONS[entry.weatherMode === 'preset' ? entry.weatherPreset : entry.weatherMode] || Sun;
  const isCustomPosition = entry.positionType === 'custom';

  return (
    <button
      type="button"
      className="group relative flex items-stretch overflow-hidden rounded-xl border border-border/50 bg-card/90 text-left transition-colors hover:border-primary/40"
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
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-card/90" />
      </div>

      {/* ── Aircraft identity + flight config ─────────────── */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-2.5 pl-2 pr-3">
        {/* Row 1: Aircraft name + ICAO badge */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {entry.aircraftName}
            </span>
            {entry.aircraftICAO && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                {entry.aircraftICAO}
              </Badge>
            )}
          </div>
          {entry.livery !== 'Default' && (
            <span className="block truncate text-xs text-muted-foreground">{entry.livery}</span>
          )}
        </div>

        {/* Row 2: Metadata as icon·value pairs (AircraftPreview dot-separator pattern) */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
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
            {entry.useRealWorldTime ? 'Live' : formatTimeOfDay(entry.timeOfDay)}
          </span>
          <span className="text-border">·</span>
          <span>{entry.coldAndDark ? 'Cold & Dark' : 'Ready'}</span>
        </div>
      </div>

      {/* ── Separator ─────────────────────────────────────── */}
      <div className="h-auto w-px self-stretch bg-border/30" />

      {/* ── Location ──────────────────────────────────────── */}
      <div className="flex w-48 shrink-0 flex-col items-end justify-center px-4 py-2">
        {isCustomPosition ? (
          <>
            <MapPin className="mb-1 h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-mono text-sm font-bold leading-tight text-foreground">
              {entry.startPosition.latitude >= 0 ? 'N' : 'S'}
              {Math.abs(entry.startPosition.latitude).toFixed(3)}°{' '}
              {entry.startPosition.longitude >= 0 ? 'E' : 'W'}
              {Math.abs(entry.startPosition.longitude).toFixed(3)}°
            </span>
          </>
        ) : (
          <>
            <span className="font-mono text-lg font-bold leading-none text-foreground">
              {entry.airportICAO}
            </span>
            {entry.airportName && (
              <span className="mt-0.5 max-w-full truncate text-right text-xs text-muted-foreground">
                {entry.airportName}
              </span>
            )}
            <span className="mt-1 font-mono text-sm font-medium text-primary">
              {entry.positionType === 'runway' ? `RWY ${entry.positionName}` : entry.positionName}
            </span>
          </>
        )}
      </div>

      {/* Relative time */}
      <span className="absolute bottom-1 right-3 font-mono text-[10px] text-muted-foreground/30">
        {formatRelativeTime(entry.launchedAt)}
      </span>

      {/* Delete button */}
      <button
        type="button"
        className={cn(
          'absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md transition-opacity',
          'bg-background/80 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          hovered ? 'opacity-100' : 'opacity-0'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </button>
  );
}
