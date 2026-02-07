import maplibregl from 'maplibre-gl';

export function getSunPosition(): [number, number, number] {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
  const hourUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  const sunLongitude = (12 - hourUTC) * 15;
  const azimuth = (sunLongitude + 360) % 360;
  const polar = 90 - Math.abs(declination);
  return [1.5, azimuth, polar];
}

export function setupGlobeProjection(map: maplibregl.Map): () => void {
  map.setProjection({ type: 'globe' });
  map.setSky({
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  });

  const updateLight = () => {
    map.setLight({ anchor: 'map', position: getSunPosition() });
  };

  updateLight();
  const intervalId = setInterval(updateLight, 60000);

  return () => clearInterval(intervalId);
}
