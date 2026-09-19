import type { LandingRating } from '@/types/flightRecorder';

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDateTime(epochMs: number, locale?: string): string {
  return new Date(epochMs).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSigned(value: number, digits = 0): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

export const RATING_TEXT_CLASS: Record<LandingRating, string> = {
  butter: 'text-yellow-300',
  great: 'text-green-400',
  acceptable: 'text-emerald-400',
  hard: 'text-orange-400',
  severe: 'text-red-400',
};

export const RATING_BG_CLASS: Record<LandingRating, string> = {
  butter: 'bg-yellow-300',
  great: 'bg-green-400',
  acceptable: 'bg-emerald-400',
  hard: 'bg-orange-400',
  severe: 'bg-red-400',
};

export const RATING_BORDER_CLASS: Record<LandingRating, string> = {
  butter: 'border-yellow-300/60',
  great: 'border-green-400/60',
  acceptable: 'border-emerald-400/60',
  hard: 'border-orange-400/60',
  severe: 'border-red-400/60',
};
