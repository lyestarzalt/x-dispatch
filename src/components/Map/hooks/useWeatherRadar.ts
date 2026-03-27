import { useCallback, useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { safeRemove } from '../layers/types';
import type { MapRef } from './useMapSetup';

interface RadarFrame {
  time: number;
  path: string;
}

interface RainViewerResponse {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RadarFrame[];
    nowcast: RadarFrame[];
  };
}

export interface WeatherRadarControls {
  isPlaying: boolean;
  currentTimestamp: number | null;
  frameIndex: number;
  frameCount: number;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
}

const RADAR_OPACITY = 0.7;
const ANIMATION_INTERVAL = 500;
const REFETCH_INTERVAL = 10 * 60 * 1000; // 10 minutes

function radarSourceId(index: number) {
  return `rainviewer-source-${index}`;
}

function radarLayerId(index: number) {
  return `rainviewer-layer-${index}`;
}

function removeAllRadar(map: maplibregl.Map, count: number) {
  safeRemove(map, () => {
    for (let i = 0; i < count; i++) {
      const layerId = radarLayerId(i);
      const sourceId = radarSourceId(i);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  });
}

export function useWeatherRadar(mapRef: MapRef, enabled: boolean): WeatherRadarControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [host, setHost] = useState('');

  const framesRef = useRef<RadarFrame[]>([]);
  const frameIndexRef = useRef(0);
  const prevFrameCountRef = useRef(0);
  const activeLayerRef = useRef<number | null>(null);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refetchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);
  useEffect(() => {
    frameIndexRef.current = frameIndex;
  }, [frameIndex]);

  // Fetch radar data from RainViewer API
  const fetchRadarData = useCallback(async () => {
    try {
      const resp = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data: RainViewerResponse = await resp.json();
      const allFrames = [...data.radar.past, ...data.radar.nowcast];
      setHost(data.host);
      setFrames(allFrames);
      const pastCount = data.radar.past.length;
      setFrameIndex(pastCount > 0 ? pastCount - 1 : 0);
    } catch (err) {
      console.error('Failed to fetch RainViewer data:', err);
    }
  }, []);

  // Show a single frame — hides the previous one, lazily creates layers
  const showFrameOnMap = useCallback((map: maplibregl.Map, index: number) => {
    // Hide the currently active layer
    const prev = activeLayerRef.current;
    if (prev !== null && prev !== index) {
      const prevLayer = radarLayerId(prev);
      if (map.getLayer(prevLayer)) {
        map.setLayoutProperty(prevLayer, 'visibility', 'none');
      }
    }

    const layerId = radarLayerId(index);
    if (map.getLayer(layerId)) {
      // Layer exists (tiles cached) — just show it
      map.setLayoutProperty(layerId, 'visibility', 'visible');
    } else if (map.getSource(radarSourceId(index))) {
      // Layer doesn't exist yet — create it (triggers tile fetch for this frame only)
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: radarSourceId(index),
        layout: { visibility: 'visible' },
        paint: { 'raster-opacity': RADAR_OPACITY },
      });
    }
    activeLayerRef.current = index;
  }, []);

  // Add sources only (no layers = no tile fetching)
  const addRadarSources = useCallback(() => {
    const map = mapRef.current;
    if (!map || framesRef.current.length === 0 || !host) return;

    // Remove stale data from previous session
    removeAllRadar(map, prevFrameCountRef.current);
    activeLayerRef.current = null;

    const currentFrames = framesRef.current;
    prevFrameCountRef.current = currentFrames.length;

    // Add sources only — MapLibre won't fetch tiles until a layer references them
    currentFrames.forEach((frame, i) => {
      const sourceId = radarSourceId(i);
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [`${host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`],
          tileSize: 512,
          maxzoom: 6,
        });
      }
    });

    // Show the current frame
    showFrameOnMap(map, frameIndexRef.current);
  }, [mapRef, host, showFrameOnMap]);

  // Enable: fetch data, start refetch timer
  useEffect(() => {
    if (!enabled) return;

    fetchRadarData();

    refetchRef.current = setInterval(fetchRadarData, REFETCH_INTERVAL);
    return () => {
      if (refetchRef.current) clearInterval(refetchRef.current);
    };
  }, [enabled, fetchRadarData]);

  // When frames or host change, add sources to map
  useEffect(() => {
    if (!enabled || frames.length === 0 || !host) return;

    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      addRadarSources();
    } else {
      map.once('style.load', addRadarSources);
    }
  }, [enabled, frames, host, mapRef, addRadarSources]);

  // Update visible frame when frameIndex changes
  useEffect(() => {
    if (!enabled || frames.length === 0) return;
    const map = mapRef.current;
    if (!map) return;
    showFrameOnMap(map, frameIndex);
  }, [enabled, frames.length, frameIndex, mapRef, showFrameOnMap]);

  // Cleanup when disabled
  useEffect(() => {
    if (enabled) return;

    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);

    const map = mapRef.current;
    if (map) {
      removeAllRadar(map, prevFrameCountRef.current);
      prevFrameCountRef.current = 0;
      activeLayerRef.current = null;
    }

    setFrames([]);
    setHost('');
    setFrameIndex(0);
  }, [enabled, mapRef]);

  // Animation play/pause
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    animationRef.current = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % framesRef.current.length);
    }, ANIMATION_INTERVAL);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, frames.length]);

  // Cleanup on unmount
  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
      if (refetchRef.current) clearInterval(refetchRef.current);
      if (map) {
        removeAllRadar(map, prevFrameCountRef.current);
      }
    };
  }, [mapRef]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setFrameIndex((prev) => (prev + 1) % framesRef.current.length);
  }, []);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setFrameIndex((prev) => (prev - 1 + framesRef.current.length) % framesRef.current.length);
  }, []);

  const currentFrame =
    frames.length > 0 && frameIndex < frames.length ? frames[frameIndex] : undefined;
  const currentTimestamp = currentFrame?.time ?? null;

  return {
    isPlaying,
    currentTimestamp,
    frameIndex,
    frameCount: frames.length,
    play,
    pause,
    stepForward,
    stepBack,
  };
}
