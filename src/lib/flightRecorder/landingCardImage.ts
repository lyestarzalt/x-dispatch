import type { LandingRating, LandingReport } from '@/types/flightRecorder';

export const RATING_COLORS: Record<LandingRating, string> = {
  butter: '#facc15',
  great: '#4ade80',
  acceptable: '#34d399',
  hard: '#fb923c',
  severe: '#f87171',
};

export interface LandingCardLabels {
  title: string;
  rating: string;
  runway: string;
  stats: Array<{ label: string; value: string }>;
  footer: string;
}

const WIDTH = 720;
const HEIGHT = 400;
const SCALE = 2;

/** Draws the landing card as a PNG. Labels arrive translated so this stays free of i18n. */
export function renderLandingCard(
  report: LandingReport,
  labels: LandingCardLabels
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(SCALE, SCALE);

  const accent = RATING_COLORS[report.rating];
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 24);
  ctx.fill();

  ctx.fillStyle = accent;
  roundRect(ctx, 0, 0, 10, HEIGHT, 24);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(labels.title.toUpperCase(), 40, 46);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillText(labels.runway, 40, 76);

  ctx.fillStyle = accent;
  ctx.font = '800 96px system-ui, sans-serif';
  const rate = `${report.touchdownRateFpm}`;
  ctx.fillText(rate, 40, 178);
  const rateWidth = ctx.measureText(rate).width;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('fpm', 48 + rateWidth, 178);

  ctx.fillStyle = accent;
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillText(labels.rating, 40, 222);

  const columns = 3;
  const cellW = (WIDTH - 80) / columns;
  labels.stats.slice(0, 6).forEach((stat, i) => {
    const x = 40 + (i % columns) * cellW;
    const y = 276 + Math.floor(i / columns) * 60;
    ctx.fillStyle = '#64748b';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(stat.label.toUpperCase(), x, y);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(stat.value, x, y + 28);
  });

  ctx.fillStyle = '#475569';
  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillText(labels.footer, 40, HEIGHT - 24);

  return canvas;
}

export async function landingCardBlob(
  report: LandingReport,
  labels: LandingCardLabels
): Promise<Blob | null> {
  const canvas = renderLandingCard(report, labels);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function copyLandingCard(
  report: LandingReport,
  labels: LandingCardLabels
): Promise<boolean> {
  const blob = await landingCardBlob(report, labels);
  if (!blob) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
