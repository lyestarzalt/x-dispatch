import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import { Runway, RunwayMarking } from '@/lib/aptParser/types';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Calculate a point at distance/bearing from origin
 */
function calculatePoint(
  lat: number,
  lon: number,
  distanceMeters: number,
  bearingDegrees: number
): [number, number] {
  const R = 6371e3;
  const d = distanceMeters / R;
  const brng = (bearingDegrees * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/**
 * Calculate true bearing between two points
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Runway Markings Layer - Creates realistic runway markings
 * Includes threshold bars, numbers, aiming points, touchdown zone, centerline
 */
export class RunwayMarkingsLayer extends BaseLayerRenderer {
  layerId = 'airport-runway-markings';
  sourceId = 'airport-runway-markings';
  additionalLayerIds = [
    'airport-runway-numbers',
    'airport-runway-threshold-bars',
    'airport-runway-aiming-points',
    'airport-runway-tdz-marks',
  ];

  private numberSourceId = 'airport-runway-numbers';

  hasData(airport: ParsedAirport): boolean {
    return airport.runways && airport.runways.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    // Create markings GeoJSON
    const markings = this.generateMarkings(airport.runways);
    this.addSource(map, markings);

    // Create numbers GeoJSON
    const numbers = this.generateRunwayNumbers(airport.runways);
    if (!map.getSource(this.numberSourceId)) {
      map.addSource(this.numberSourceId, {
        type: 'geojson',
        data: numbers,
      });
    }

    // Threshold bars
    this.addLayer(map, {
      id: 'airport-runway-threshold-bars',
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'threshold'],
      minzoom: 14,
      paint: {
        'fill-color': '#FFFFFF',
        'fill-opacity': 0.95,
      },
    });

    // Aiming points (big rectangles)
    this.addLayer(map, {
      id: 'airport-runway-aiming-points',
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'aiming'],
      minzoom: 14,
      paint: {
        'fill-color': '#FFFFFF',
        'fill-opacity': 0.95,
      },
    });

    // Touchdown zone marks
    this.addLayer(map, {
      id: 'airport-runway-tdz-marks',
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'tdz'],
      minzoom: 15,
      paint: {
        'fill-color': '#FFFFFF',
        'fill-opacity': 0.9,
      },
    });

    // Runway numbers - large white text
    this.addLayer(map, {
      id: 'airport-runway-numbers',
      type: 'symbol',
      source: this.numberSourceId,
      minzoom: 13,
      layout: {
        'text-field': ['get', 'number'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 16, 15, 28, 17, 48, 19, 72],
        'text-rotate': ['get', 'rotation'],
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'map',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#000000',
        'text-halo-width': 1,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.7, 15, 1],
      },
    });
  }

  private generateMarkings(runways: Runway[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    for (const runway of runways) {
      const end1 = runway.ends[0];
      const end2 = runway.ends[1];
      const width = runway.width;

      // Calculate TRUE bearing from coordinates
      const heading1 = calculateBearing(
        end1.latitude,
        end1.longitude,
        end2.latitude,
        end2.longitude
      );
      const heading2 = (heading1 + 180) % 360;

      // Generate threshold bars for each end
      if (end1.marking >= RunwayMarking.VISUAL) {
        this.generateThresholdBars(features, end1, heading1, width);
      }
      if (end2.marking >= RunwayMarking.VISUAL) {
        this.generateThresholdBars(features, end2, heading2, width);
      }

      // Generate aiming points for precision runways
      if (end1.marking >= RunwayMarking.NON_PRECISION) {
        this.generateAimingPoints(features, end1, heading1, width);
      }
      if (end2.marking >= RunwayMarking.NON_PRECISION) {
        this.generateAimingPoints(features, end2, heading2, width);
      }

      // Generate TDZ marks for precision runways
      if (end1.marking >= RunwayMarking.PRECISION) {
        this.generateTDZMarks(features, end1, heading1, width);
      }
      if (end2.marking >= RunwayMarking.PRECISION) {
        this.generateTDZMarks(features, end2, heading2, width);
      }
    }

    return { type: 'FeatureCollection', features };
  }

  private generateRunwayNumbers(runways: Runway[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    for (const runway of runways) {
      const end1 = runway.ends[0];
      const end2 = runway.ends[1];

      // Calculate TRUE bearing from coordinates
      const heading1 = calculateBearing(
        end1.latitude,
        end1.longitude,
        end2.latitude,
        end2.longitude
      );
      const heading2 = (heading1 + 180) % 360;

      // Number position - 300m from threshold
      const pos1 = calculatePoint(end1.latitude, end1.longitude, 300, heading1);
      const pos2 = calculatePoint(end2.latitude, end2.longitude, 300, heading2);

      // Format runway number with L/C/R designation
      const suffix1 = end1.name.match(/[LCR]$/)?.[0] || '';
      const suffix2 = end2.name.match(/[LCR]$/)?.[0] || '';
      const num1 = end1.name.replace(/[LCR]$/, '');
      const num2 = end2.name.replace(/[LCR]$/, '');

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pos1 },
        properties: {
          number: num1 + (suffix1 ? '\n' + suffix1 : ''),
          rotation: heading1,
          fullName: end1.name,
        },
      });

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pos2 },
        properties: {
          number: num2 + (suffix2 ? '\n' + suffix2 : ''),
          rotation: heading2,
          fullName: end2.name,
        },
      });
    }

    return { type: 'FeatureCollection', features };
  }

  private generateThresholdBars(
    features: GeoJSON.Feature[],
    end: { latitude: number; longitude: number },
    heading: number,
    width: number
  ): void {
    // Standard threshold has 8 bars (4 on each side), each 45m long, 1.8m wide
    const numBars = 8;
    const barLength = Math.min(45, width * 0.4);
    const barWidth = 1.8;
    const barSpacing = 1.8;
    const startOffset = 6; // Distance from threshold

    for (let i = 0; i < numBars; i++) {
      const sideOffset =
        i < numBars / 2
          ? -(barSpacing * (numBars / 4 - i - 0.5) + barWidth / 2)
          : barSpacing * (i - numBars / 2 + 0.5) - barWidth / 2;

      const barCenter = calculatePoint(
        end.latitude,
        end.longitude,
        startOffset + barLength / 2,
        heading
      );

      const barCenterOffset = calculatePoint(
        barCenter[1],
        barCenter[0],
        Math.abs(sideOffset),
        sideOffset < 0 ? heading - 90 : heading + 90
      );

      // Create bar polygon
      const corners = [
        calculatePoint(barCenterOffset[1], barCenterOffset[0], barLength / 2, heading),
        calculatePoint(barCenterOffset[1], barCenterOffset[0], barLength / 2, heading + 180),
      ];

      const polygon = [
        calculatePoint(corners[0][1], corners[0][0], barWidth / 2, heading - 90),
        calculatePoint(corners[0][1], corners[0][0], barWidth / 2, heading + 90),
        calculatePoint(corners[1][1], corners[1][0], barWidth / 2, heading + 90),
        calculatePoint(corners[1][1], corners[1][0], barWidth / 2, heading - 90),
      ];
      polygon.push(polygon[0]); // Close polygon

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [polygon] },
        properties: { type: 'threshold' },
      });
    }
  }

  private generateAimingPoints(
    features: GeoJSON.Feature[],
    end: { latitude: number; longitude: number },
    heading: number,
    width: number
  ): void {
    // Aiming points: Two large rectangles 300m from threshold
    const distance = 300;
    const length = 45;
    const rectWidth = 10;
    const sideOffset = width * 0.25;

    for (const side of [-1, 1]) {
      const center = calculatePoint(end.latitude, end.longitude, distance, heading);
      const offsetCenter = calculatePoint(center[1], center[0], sideOffset, heading + side * 90);

      const corners = [
        calculatePoint(offsetCenter[1], offsetCenter[0], length / 2, heading),
        calculatePoint(offsetCenter[1], offsetCenter[0], length / 2, heading + 180),
      ];

      const polygon = [
        calculatePoint(corners[0][1], corners[0][0], rectWidth / 2, heading - 90),
        calculatePoint(corners[0][1], corners[0][0], rectWidth / 2, heading + 90),
        calculatePoint(corners[1][1], corners[1][0], rectWidth / 2, heading + 90),
        calculatePoint(corners[1][1], corners[1][0], rectWidth / 2, heading - 90),
      ];
      polygon.push(polygon[0]);

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [polygon] },
        properties: { type: 'aiming' },
      });
    }
  }

  private generateTDZMarks(
    features: GeoJSON.Feature[],
    end: { latitude: number; longitude: number },
    heading: number,
    width: number
  ): void {
    // TDZ marks: pairs of rectangles at 150m intervals
    const distances = [150, 300, 450, 600, 750, 900];
    const markLength = 22.5;
    const markWidth = 3;
    const sideOffset = width * 0.15;

    // Number of pairs decreases with distance
    const pairCounts = [3, 3, 2, 2, 1, 1];

    distances.forEach((dist, idx) => {
      const numPairs = pairCounts[idx];

      for (let pair = 0; pair < numPairs; pair++) {
        const pairOffset = pair * 1.5;

        for (const side of [-1, 1]) {
          const center = calculatePoint(end.latitude, end.longitude, dist, heading);
          const offsetCenter = calculatePoint(
            center[1],
            center[0],
            sideOffset + pairOffset,
            heading + side * 90
          );

          const corners = [
            calculatePoint(offsetCenter[1], offsetCenter[0], markLength / 2, heading),
            calculatePoint(offsetCenter[1], offsetCenter[0], markLength / 2, heading + 180),
          ];

          const polygon = [
            calculatePoint(corners[0][1], corners[0][0], markWidth / 2, heading - 90),
            calculatePoint(corners[0][1], corners[0][0], markWidth / 2, heading + 90),
            calculatePoint(corners[1][1], corners[1][0], markWidth / 2, heading + 90),
            calculatePoint(corners[1][1], corners[1][0], markWidth / 2, heading - 90),
          ];
          polygon.push(polygon[0]);

          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [polygon] },
            properties: { type: 'tdz' },
          });
        }
      }
    });
  }

  remove(map: maplibregl.Map): void {
    // Remove number source
    if (map.getLayer('airport-runway-numbers')) {
      map.removeLayer('airport-runway-numbers');
    }
    if (map.getSource(this.numberSourceId)) {
      map.removeSource(this.numberSourceId);
    }
    super.remove(map);
  }
}
