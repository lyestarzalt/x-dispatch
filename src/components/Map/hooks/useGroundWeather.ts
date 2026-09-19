import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { type GroundWeather, groundWeatherFrom } from '@/lib/groundWeather/groundWeather';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

const MIN_ZOOM = 12;
const MIN_WIND_KT = 4;
const FRAME_MS = 40;
const WIND_PARTICLES_PER_MEGAPIXEL = 90;
const PRECIP_PARTICLES_PER_MEGAPIXEL = 260;

interface Particle {
  x: number;
  y: number;
  /** 0..1 life, streak length and alpha come from it. */
  life: number;
  speed: number;
}

function spawn(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    life: Math.random(),
    speed: 0.7 + Math.random() * 0.6,
  };
}

/**
 * Wind streaks, rain or snow and a fog vignette over the selected airport,
 * drawn on a 2D canvas from the METAR the info panel already fetched. Screen
 * space only, so the map never repaints for it; the loop stops when there is
 * nothing to show.
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
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wind: Particle[] = [];
    let drops: Particle[] = [];

    const cssSize = () => {
      const dpr = window.devicePixelRatio || 1;
      return { w: canvas.width / dpr, h: canvas.height / dpr, dpr };
    };

    const seed = () => {
      const { w, h } = cssSize();
      const megapixels = (w * h) / 1_000_000;
      const windCount = hasWind ? Math.round(WIND_PARTICLES_PER_MEGAPIXEL * megapixels) : 0;
      const dropCount =
        precip === 'none' ? 0 : Math.round(PRECIP_PARTICLES_PER_MEGAPIXEL * megapixels);
      wind = Array.from({ length: windCount }, () => spawn(w, h));
      drops = Array.from({ length: dropCount }, () => spawn(w, h));
    };

    const inView = () => map.getZoom() >= MIN_ZOOM && !document.hidden;

    // Wind blows *from* windFromDeg; on screen the streaks travel the other way,
    // corrected for the map bearing so they stay true to the ground.
    const screenWind = () => {
      const toDeg = ((windFromDeg ?? 0) + 180 - map.getBearing()) * (Math.PI / 180);
      return { dx: Math.sin(toDeg), dy: -Math.cos(toDeg) };
    };

    const drawFog = (w: number, h: number) => {
      if (fog <= 0) return;
      const r = Math.hypot(w, h) / 2;
      const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.25 * (1 - fog * 0.6), w / 2, h / 2, r);
      g.addColorStop(0, 'rgba(180,190,200,0)');
      g.addColorStop(1, `rgba(180,190,200,${0.55 * fog})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const render = () => {
      if (cancelled) return;
      if (!inView()) {
        clear();
        running = false;
        return;
      }
      const animated = hasWind || precip !== 'none';
      if (animated) timer = setTimeout(render, FRAME_MS);
      else running = false;

      const { w, h, dpr } = cssSize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawFog(w, h);
      if (!animated) return;

      const { dx, dy } = screenWind();
      const zoomScale = Math.min(2, Math.max(0.5, 2 ** (map.getZoom() - 14)));
      const windPx = (0.35 + windKt * 0.09) * zoomScale;

      ctx.lineCap = 'round';
      ctx.lineWidth = 1.2;
      for (const p of wind) {
        p.x += dx * windPx * p.speed;
        p.y += dy * windPx * p.speed;
        p.life += 0.012;
        if (p.life > 1 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
          Object.assign(p, spawn(w, h), { life: 0 });
        }
        const len = 6 + windKt * 0.8 * zoomScale;
        const alpha = 0.35 * Math.sin(p.life * Math.PI);
        ctx.strokeStyle = `rgba(220,235,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p.x - dx * len, p.y - dy * len);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      if (precip === 'rain') {
        ctx.lineWidth = 1;
        for (const p of drops) {
          const fall = 5 * zoomScale * p.speed;
          p.x += dx * windPx * 0.6;
          p.y += fall;
          if (p.y > h + 10) Object.assign(p, spawn(w, h), { y: -10 });
          ctx.strokeStyle = 'rgba(170,200,255,0.45)';
          ctx.beginPath();
          ctx.moveTo(p.x - dx * 3, p.y - fall * 1.6);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      } else if (precip === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (const p of drops) {
          p.x += dx * windPx * 0.35 + Math.sin(p.life * 12) * 0.4;
          p.y += 0.9 * zoomScale * p.speed;
          p.life += 0.01;
          if (p.y > h + 4) Object.assign(p, spawn(w, h), { y: -4 });
          ctx.beginPath();
          ctx.arc(p.x, p.y, 0.8 + p.speed, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const start = () => {
      if (cancelled || running || !inView()) return;
      running = true;
      render();
    };

    seed();
    start();
    const onMove = () => {
      if (hasWind || precip !== 'none') start();
      else render();
    };
    map.on('moveend', onMove);
    map.on('resize', seed);
    document.addEventListener('visibilitychange', start);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      map.off('moveend', onMove);
      map.off('resize', seed);
      document.removeEventListener('visibilitychange', start);
      clear();
    };
  }, [mapRef, enabled, icao, windFromDeg, windKt, precip, fog]);
}
