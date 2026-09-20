import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { type GroundWeather, groundWeatherFrom } from '@/lib/groundWeather/groundWeather';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

const MIN_ZOOM = 12;
const MIN_WIND_KT = 4;
const FRAME_MS = 1000 / 60;
const MAX_DT_S = 0.05;
/** Soft effects do not need retina pixels; 1x quarters the fill cost on 2x screens. */
const MAX_BACKING_SCALE = 1;
/** Fraction of the previous frame erased each frame; lower keeps longer trails. */
const TRAIL_FADE = 0.09;
const WIND_PARTICLES_PER_MEGAPIXEL = 140;
const RAIN_PARTICLES_PER_MEGAPIXEL = 90;
const SNOW_PARTICLES_PER_MEGAPIXEL = 70;
const FOG_BLOBS = 6;
const SNOW_LIFE_S = 3;
const SNOW_HAZE = 0.12;
const RIPPLE_LIFE_S = 0.7;
const FLAKE_SPRITE_PX = 48;
const BLOB_SPRITE_PX = 128;
/** Strokes are grouped by quantised alpha and width so a frame is a few paths, not hundreds. */
const ALPHA_STEPS = 6;
const WIDTH_STEPS = 3;

interface Particle {
  x: number;
  y: number;
  /** Seconds lived, reset on respawn. */
  age: number;
  maxAge: number;
  /** Depth 0.5..1.3: bigger is closer, faster and brighter. */
  depth: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
}

interface Blob {
  x: number;
  y: number;
  r: number;
  drift: number;
}

function backingScale(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_BACKING_SCALE);
}

function spawn(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    age: Math.random() * 3,
    maxAge: 2.5 + Math.random() * 3,
    depth: 0.5 + Math.random() * 0.8,
  };
}

function spawnBlob(w: number, h: number): Blob {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.max(w, h) * (0.18 + Math.random() * 0.2),
    drift: 0.4 + Math.random() * 0.6,
  };
}

function offscreen(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  return ctx ? [c, ctx] : null;
}

/** Six-armed flake with a soft core, rendered once and stamped per particle. */
function flakeSprite(): HTMLCanvasElement | null {
  const off = offscreen(FLAKE_SPRITE_PX);
  if (!off) return null;
  const [c, ctx] = off;
  const mid = FLAKE_SPRITE_PX / 2;
  const arm = mid * 0.85;
  const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.45);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FLAKE_SPRITE_PX, FLAKE_SPRITE_PX);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.lineTo(mid + ux * arm, mid + uy * arm);
    ctx.stroke();
    // Two short branches on each arm give the flake its lattice look.
    const bx = mid + ux * arm * 0.55;
    const by = mid + uy * arm * 0.55;
    const len = arm * 0.3;
    for (const side of [-1, 1]) {
      const ba = a + (side * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ba) * len, by + Math.sin(ba) * len);
      ctx.stroke();
    }
  }
  return c;
}

/** Soft white disc for fog patches; scaled with drawImage instead of a gradient per frame. */
function blobSprite(): HTMLCanvasElement | null {
  const off = offscreen(BLOB_SPRITE_PX);
  if (!off) return null;
  const [c, ctx] = off;
  const mid = BLOB_SPRITE_PX / 2;
  const g = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  g.addColorStop(0, 'rgba(200,206,214,1)');
  g.addColorStop(1, 'rgba(200,206,214,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BLOB_SPRITE_PX, BLOB_SPRITE_PX);
  return c;
}

/** Line segments bucketed by alpha and width so each bucket strokes as one path. */
class SegmentBatch {
  private readonly buckets: number[][] = Array.from(
    { length: ALPHA_STEPS * WIDTH_STEPS },
    () => []
  );

  add(x0: number, y0: number, x1: number, y1: number, alpha: number, width: number) {
    const a = Math.min(ALPHA_STEPS - 1, Math.floor(alpha * ALPHA_STEPS));
    const wIdx = Math.min(WIDTH_STEPS - 1, Math.floor(width * WIDTH_STEPS));
    this.buckets[a * WIDTH_STEPS + wIdx]?.push(x0, y0, x1, y1);
  }

  /** `alpha` and `width` here are the bucket's 0..1 positions, mapped by the caller. */
  flush(
    ctx: CanvasRenderingContext2D,
    color: (alpha: number) => string,
    widthPx: (width: number) => number
  ) {
    for (let i = 0; i < this.buckets.length; i++) {
      const seg = this.buckets[i];
      if (!seg || seg.length === 0) continue;
      const a = (Math.floor(i / WIDTH_STEPS) + 0.5) / ALPHA_STEPS;
      const wPos = ((i % WIDTH_STEPS) + 0.5) / WIDTH_STEPS;
      ctx.strokeStyle = color(a);
      ctx.lineWidth = widthPx(wPos);
      ctx.beginPath();
      for (let j = 0; j < seg.length; j += 4) {
        ctx.moveTo(seg[j] as number, seg[j + 1] as number);
        ctx.lineTo(seg[j + 2] as number, seg[j + 3] as number);
      }
      ctx.stroke();
      seg.length = 0;
    }
  }
}

/**
 * Wind streaks, rain or snow and drifting fog over the selected airport,
 * drawn on a 2D canvas from the METAR the info panel already fetched. Screen
 * space only, so the map never repaints for it. Frames fade instead of
 * clearing so particles leave motion trails; the loop stops when there is
 * nothing to show or the airport is zoomed out.
 */
export function useGroundWeather(mapRef: MapRef): void {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const enabled = useSettingsStore((s) => s.graphics.groundWeather);
  const icao = useAppStore((s) => s.selectedICAO);
  const { data: metar } = useVatsimMetarQuery(enabled ? icao : null);
  const weather: GroundWeather = groundWeatherFrom(metar?.parsed);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4';
    container.appendChild(canvas);
    canvasRef.current = canvas;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const scale = backingScale();
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => {
      observer.disconnect();
      canvas.remove();
      canvasRef.current = null;
    };
  }, [mapRef]);

  const { windFromDeg, windKt, precip, fog } = weather;

  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const hasWind = windFromDeg !== null && windKt >= MIN_WIND_KT;
    const active = enabled && icao !== null && (hasWind || precip !== 'none' || fog > 0);
    if (!active) {
      clear();
      return;
    }

    let cancelled = false;
    let running = false;
    let moving = false;
    let blank = false;
    let frame = 0;
    let lastMs = 0;
    let wind: Particle[] = [];
    let drops: Particle[] = [];
    let blobs: Blob[] = [];
    let vignette: CanvasGradient | null = null;
    const ripples: Ripple[] = [];
    const batch = new SegmentBatch();
    const flake = precip === 'snow' ? flakeSprite() : null;
    const blob = fog > 0 ? blobSprite() : null;

    const cssSize = () => {
      const scale = backingScale();
      return { w: canvas.width / scale, h: canvas.height / scale, scale };
    };

    const seed = () => {
      const { w, h } = cssSize();
      const megapixels = (w * h) / 1_000_000;
      const windCount = hasWind ? Math.round(WIND_PARTICLES_PER_MEGAPIXEL * megapixels) : 0;
      const perMegapixel =
        precip === 'rain'
          ? RAIN_PARTICLES_PER_MEGAPIXEL
          : precip === 'snow'
            ? SNOW_PARTICLES_PER_MEGAPIXEL
            : 0;
      const dropCount = Math.round(perMegapixel * megapixels);
      wind = Array.from({ length: windCount }, () => spawn(w, h));
      drops = Array.from({ length: dropCount }, () => spawn(w, h));
      blobs = fog > 0 ? Array.from({ length: FOG_BLOBS }, () => spawnBlob(w, h)) : [];
      ripples.length = 0;
      if (fog > 0) {
        const r = Math.hypot(w, h) / 2;
        vignette = ctx.createRadialGradient(w / 2, h / 2, r * 0.3, w / 2, h / 2, r);
        vignette.addColorStop(0, 'rgba(190,198,208,0)');
        vignette.addColorStop(1, `rgba(190,198,208,${0.85 * fog * TRAIL_FADE})`);
      }
    };

    const inView = () => map.getZoom() >= MIN_ZOOM && !document.hidden;

    // Wind blows *from* windFromDeg; on screen the streaks travel the other way,
    // corrected for the map bearing so they stay true to the ground.
    const screenWind = () => {
      const toDeg = ((windFromDeg ?? 0) + 180 - map.getBearing()) * (Math.PI / 180);
      return { dx: Math.sin(toDeg), dy: -Math.cos(toDeg) };
    };

    const fade = (w: number, h: number, amount: number) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${amount})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    };

    // Drawn every frame on top of the fade, so the visible alpha settles at
    // (drawn alpha / TRAIL_FADE): scale down to land on the intended strength.
    const drawFog = (w: number, h: number, dx: number, dy: number, dt: number) => {
      if (fog <= 0 || !blob) return;
      const speed = (6 + windKt * 1.5) * dt;
      ctx.globalAlpha = 0.6 * fog * TRAIL_FADE;
      for (const b of blobs) {
        b.x += dx * speed * b.drift;
        b.y += dy * speed * b.drift;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;
        ctx.drawImage(blob, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      }
      ctx.globalAlpha = 1;
      if (vignette) {
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const render = (nowMs: number) => {
      if (cancelled) return;
      if (!inView()) {
        clear();
        running = false;
        return;
      }
      frame = requestAnimationFrame(render);
      // Particles live in screen space: while the camera moves, old trails
      // would smear over ground that has shifted, so show nothing until it stops.
      if (moving) {
        if (!blank) {
          clear();
          blank = true;
        }
        return;
      }
      if (nowMs - lastMs < FRAME_MS) return;
      blank = false;
      const dt = lastMs === 0 ? FRAME_MS / 1000 : Math.min(MAX_DT_S, (nowMs - lastMs) / 1000);
      lastMs = nowMs;

      const { w, h, scale } = cssSize();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      fade(w, h, TRAIL_FADE);

      const { dx, dy } = screenWind();
      const zoomScale = Math.min(2, Math.max(0.5, 2 ** (map.getZoom() - 14)));
      drawFog(w, h, dx, dy, dt);

      const windPxPerS = (25 + windKt * 7) * zoomScale;
      const gust = 1 + 0.15 * Math.sin(nowMs / 900);

      if (hasWind) {
        for (const p of wind) {
          const step = windPxPerS * p.depth * gust * dt;
          const px = p.x;
          const py = p.y;
          p.x += dx * step;
          p.y += dy * step;
          p.age += dt;
          if (p.age > p.maxAge || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
            Object.assign(p, spawn(w, h), { age: 0 });
            continue;
          }
          const life = p.age / p.maxAge;
          const alpha = Math.sin(life * Math.PI) * (0.5 + p.depth * 0.5);
          batch.add(px, py, p.x, p.y, alpha, (p.depth - 0.5) / 0.8);
        }
        ctx.lineCap = 'round';
        batch.flush(
          ctx,
          (a) => `rgba(225,238,255,${0.55 * a})`,
          (wPos) => 0.8 + wPos * 0.8
        );
      }

      if (precip === 'rain') {
        const fallPxPerS = 900 * zoomScale;
        const slant = (dx * windPxPerS) / fallPxPerS;
        for (const p of drops) {
          const fall = fallPxPerS * p.depth * dt;
          p.y += fall;
          p.x += fall * slant;
          if (p.y > h + 10) {
            if (Math.random() < 0.08) ripples.push({ x: p.x, y: Math.random() * h, age: 0 });
            Object.assign(p, spawn(w, h), { y: -10 });
          }
          batch.add(
            p.x - fall * slant,
            p.y - fall,
            p.x,
            p.y,
            (p.depth - 0.5) / 0.8,
            (p.depth - 0.5) / 0.8
          );
        }
        ctx.lineCap = 'butt';
        batch.flush(
          ctx,
          (a) => `rgba(185,210,255,${0.12 + a * 0.16})`,
          (wPos) => 0.5 + wPos * 0.4
        );
        ctx.lineWidth = 1;
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          if (!r) continue;
          r.age += dt;
          if (r.age > RIPPLE_LIFE_S) {
            ripples.splice(i, 1);
            continue;
          }
          const t = r.age / RIPPLE_LIFE_S;
          ctx.strokeStyle = `rgba(200,220,255,${0.5 * (1 - t) * TRAIL_FADE * 4})`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 2 + t * 10 * zoomScale, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (precip === 'snow' && flake) {
        // Flakes are stamps, not streaks: erase the previous stamp so the fade
        // trail never shows behind them.
        const eraseHalf = 12 * zoomScale;
        ctx.globalCompositeOperation = 'destination-out';
        for (const p of drops) {
          ctx.fillRect(p.x - eraseHalf, p.y - eraseHalf, eraseHalf * 2, eraseHalf * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
        // Seen from above, flakes come toward the camera: they only drift with
        // the wind while growing and fading over a short life.
        const driftPxPerS = hasWind ? windPxPerS * 0.4 : 8 * zoomScale;
        for (const p of drops) {
          p.age += dt;
          p.x += dx * driftPxPerS * p.depth * dt;
          p.y += dy * driftPxPerS * p.depth * dt;
          if (p.age > SNOW_LIFE_S || p.x < -12 || p.x > w + 12 || p.y < -12 || p.y > h + 12) {
            Object.assign(p, spawn(w, h), { age: 0 });
            continue;
          }
          const life = p.age / SNOW_LIFE_S;
          const size = (6 + life * 10) * (0.6 + p.depth * 0.6) * zoomScale;
          ctx.globalAlpha = 0.9 * Math.sin(life * Math.PI);
          ctx.drawImage(flake, p.x - size / 2, p.y - size / 2, size, size);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(235,240,248,${SNOW_HAZE * TRAIL_FADE})`;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const start = () => {
      if (cancelled || running || !inView()) return;
      running = true;
      lastMs = 0;
      frame = requestAnimationFrame(render);
    };

    const onMoveStart = () => {
      moving = true;
    };
    const onMoveEnd = () => {
      moving = false;
      lastMs = 0;
      seed();
      start();
    };

    seed();
    start();
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    map.on('resize', seed);
    document.addEventListener('visibilitychange', start);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.off('resize', seed);
      document.removeEventListener('visibilitychange', start);
      clear();
    };
  }, [mapRef, enabled, icao, windFromDeg, windKt, precip, fog]);
}
