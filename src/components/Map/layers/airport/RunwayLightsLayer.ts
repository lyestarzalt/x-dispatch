import maplibregl from 'maplibre-gl';
import { RUNWAY_LIGHT_COLORS } from '@/config/mapStyles/theme';
import {
  calculateBearing,
  destinationPoint as calculatePoint,
  haversineDistance,
} from '@/lib/utils/geomath';
import type { ParsedAirport } from '@/types/apt';
import type { Runway } from '@/types/apt';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Runway Lights Layer - Creates realistic runway lighting
 */
export class RunwayLightsLayer extends BaseLayerRenderer {
  layerId = 'airport-runway-lights';
  sourceId = 'airport-runway-lights';
  additionalLayerIds = [
    'airport-runway-edge-lights',
    'airport-runway-threshold-lights',
    'airport-runway-centerline-lights',
    'airport-runway-end-lights',
    'airport-approach-lights',
  ];

  hasData(airport: ParsedAirport): boolean {
    return airport.runways && airport.runways.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const lights = this.generateRunwayLights(airport.runways);
    this.addSource(map, lights);

    // Edge lights - white/yellow (small subtle points)
    this.addLayer(map, {
      id: 'airport-runway-edge-lights',
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'edge'],
      minzoom: 14,
      paint: {
        'circle-color': [
          'case',
          ['get', 'isYellowZone'],
          RUNWAY_LIGHT_COLORS.edgeYellow,
          RUNWAY_LIGHT_COLORS.edgeWhite,
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 17, 1.5, 20, 2.5],
        'circle-blur': 0.2,
        'circle-opacity': 0.85,
      },
    });

    // Threshold lights - green (small row of points)
    this.addLayer(map, {
      id: 'airport-runway-threshold-lights',
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'threshold'],
      minzoom: 14,
      paint: {
        'circle-color': RUNWAY_LIGHT_COLORS.thresholdGreen,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1, 17, 2, 20, 3],
        'circle-blur': 0.3,
        'circle-opacity': 0.9,
      },
    });

    // End lights - red (small row of points)
    this.addLayer(map, {
      id: 'airport-runway-end-lights',
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'end'],
      minzoom: 14,
      paint: {
        'circle-color': RUNWAY_LIGHT_COLORS.endRed,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1, 17, 2, 20, 3],
        'circle-blur': 0.3,
        'circle-opacity': 0.9,
      },
    });

    // Centerline lights (very small points)
    this.addLayer(map, {
      id: 'airport-runway-centerline-lights',
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'centerline'],
      minzoom: 15,
      paint: {
        'circle-color': [
          'case',
          ['get', 'isRedZone'],
          RUNWAY_LIGHT_COLORS.centerlineRed,
          ['get', 'isYellowZone'],
          RUNWAY_LIGHT_COLORS.centerlineYellow,
          RUNWAY_LIGHT_COLORS.centerlineWhite,
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 0.5, 18, 1.5, 20, 2],
        'circle-blur': 0.2,
        'circle-opacity': 0.75,
      },
    });

    // Approach lights (small crisp points - not big blobs!)
    this.addLayer(map, {
      id: 'airport-approach-lights',
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['get', 'type'], 'approach'],
      minzoom: 13,
      paint: {
        'circle-color': [
          'case',
          ['get', 'isRed'],
          RUNWAY_LIGHT_COLORS.approachRed,
          RUNWAY_LIGHT_COLORS.approachWhite,
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 16, 1.5, 18, 2.5],
        'circle-blur': 0.2,
        'circle-opacity': 0.9,
      },
    });
  }

  private generateRunwayLights(runways: Runway[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    for (const runway of runways) {
      const end1 = runway.ends[0];
      const end2 = runway.ends[1];
      const width = runway.width;

      // Calculate TRUE bearing from coordinates (not magnetic from runway number)
      const heading1 = calculateBearing(
        end1.latitude,
        end1.longitude,
        end2.latitude,
        end2.longitude
      );
      const heading2 = (heading1 + 180) % 360;

      const length = this.calculateDistance(
        end1.latitude,
        end1.longitude,
        end2.latitude,
        end2.longitude
      );

      // Edge lights (both sides, every 60m)
      if (runway.edge_lights) {
        for (let dist = 0; dist <= length; dist += 60) {
          const ratio = dist / length;
          const lat = end1.latitude + ratio * (end2.latitude - end1.latitude);
          const lon = end1.longitude + ratio * (end2.longitude - end1.longitude);

          const leftPoint = calculatePoint(lat, lon, width / 2, heading1 - 90);
          const rightPoint = calculatePoint(lat, lon, width / 2, heading1 + 90);
          const isYellow = dist > length - 600 || dist < 600;

          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: leftPoint },
            properties: { type: 'edge', isYellowZone: isYellow, intensity: 0.9 },
          });
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: rightPoint },
            properties: { type: 'edge', isYellowZone: isYellow, intensity: 0.9 },
          });
        }
      }

      // Threshold lights (green bar at runway start)
      for (let offset = -width / 2; offset <= width / 2; offset += 3) {
        const pt1 = calculatePoint(
          end1.latitude,
          end1.longitude,
          Math.abs(offset),
          offset < 0 ? heading1 - 90 : heading1 + 90
        );
        const pt2 = calculatePoint(
          end2.latitude,
          end2.longitude,
          Math.abs(offset),
          offset < 0 ? heading2 - 90 : heading2 + 90
        );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt1 },
          properties: { type: 'threshold', intensity: 1.0 },
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt2 },
          properties: { type: 'threshold', intensity: 1.0 },
        });
      }

      // End lights (red bar)
      for (let offset = -width / 2; offset <= width / 2; offset += 3) {
        const pt1 = calculatePoint(
          end1.latitude,
          end1.longitude,
          Math.abs(offset),
          offset < 0 ? heading1 - 90 : heading1 + 90
        );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt1 },
          properties: { type: 'end', intensity: 1.0 },
        });
      }

      // Centerline lights
      if (runway.centerline_lights) {
        for (let dist = 30; dist < length - 30; dist += 15) {
          const ratio = dist / length;
          const lat = end1.latitude + ratio * (end2.latitude - end1.latitude);
          const lon = end1.longitude + ratio * (end2.longitude - end1.longitude);
          const distFromEnd = Math.min(dist, length - dist);

          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lon, lat] },
            properties: {
              type: 'centerline',
              isRedZone: distFromEnd < 300,
              isYellowZone: distFromEnd < 900 && distFromEnd >= 300,
              intensity: 0.8,
            },
          });
        }
      }

      // Approach lights
      if (end1.lighting && end1.lighting > 0) {
        this.generateApproachLights(features, end1, heading1 + 180);
      }
      if (end2.lighting && end2.lighting > 0) {
        this.generateApproachLights(features, end2, heading2 + 180);
      }
    }

    return { type: 'FeatureCollection', features };
  }

  /**
   * Calculate barIndex for approach light animation (0=near threshold, 29=far)
   * Maps distance in meters to animation index for the "rabbit" effect
   */
  private getBarIndex(dist: number): number {
    return Math.min(29, Math.max(0, Math.floor(dist / 30) - 1));
  }

  private generateApproachLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number; lighting?: number },
    approachHeading: number
  ): void {
    const lightingType = runwayEnd.lighting || 0;

    // Generate pattern based on approach lighting system type
    switch (lightingType) {
      case 1: // ALSF-I - High intensity, 2400ft with sequenced flashers
      case 2: // ALSF-II - Same as ALSF-I with red sidebars
        this.generateALSFLights(features, runwayEnd, approachHeading, lightingType === 2);
        break;
      case 3: // CALVERT - UK standard
      case 4: // CALVERT-II
        this.generateCalvertLights(features, runwayEnd, approachHeading, lightingType === 4);
        break;
      case 5: // SSALR - Simplified short with RAIL
      case 6: // SSALF - Simplified short with flashers
      case 7: // SALS - Short approach
        this.generateSSALLights(features, runwayEnd, approachHeading, lightingType === 5);
        break;
      case 8: // MALSR - Medium intensity with RAIL
      case 9: // MALSF - Medium intensity with flashers
      case 10: // MALS - Medium intensity basic
        this.generateMALSLights(features, runwayEnd, approachHeading, lightingType === 8);
        break;
      case 11: // ODALS - Omnidirectional
        this.generateODALSLights(features, runwayEnd, approachHeading);
        break;
      case 12: // RAIL - Runway alignment indicator lights only
        this.generateRAILLights(features, runwayEnd, approachHeading);
        break;
      default:
        // Generic simple approach lights for unknown types
        this.generateGenericApproachLights(features, runwayEnd, approachHeading);
    }
  }

  /**
   * ALSF-I/II - High intensity approach lighting system
   * 2400ft (730m) with centerline bars and 5 crossbars
   */
  private generateALSFLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number,
    hasRedSidebars: boolean
  ): void {
    const totalLength = 730; // meters (~2400ft)

    // Centerline barrettes - every 30m (100ft)
    for (let dist = 30; dist <= totalLength; dist += 30) {
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      const isRed = dist <= 60; // First 200ft red

      // Center barrette (5 lights wide)
      for (let offset = -6; offset <= 6; offset += 3) {
        const barPoint =
          offset === 0
            ? point
            : calculatePoint(
                point[1],
                point[0],
                Math.abs(offset),
                offset < 0 ? approachHeading - 90 : approachHeading + 90
              );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: barPoint },
          properties: {
            type: 'approach',
            isRed,
            dist,
            intensity: 1.0,
            barIndex: this.getBarIndex(dist),
          },
        });
      }
    }

    // 5 Crossbars at 60, 150, 240, 330, 450m from threshold
    const crossbarDistances = [60, 150, 240, 330, 450];
    for (const dist of crossbarDistances) {
      const center = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      const barWidth = dist <= 150 ? 10 : 15; // Inner bars narrower

      for (let offset = -barWidth; offset <= barWidth; offset += 2.5) {
        if (Math.abs(offset) < 4) continue; // Skip center area
        const barPoint = calculatePoint(
          center[1],
          center[0],
          Math.abs(offset),
          offset < 0 ? approachHeading - 90 : approachHeading + 90
        );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: barPoint },
          properties: {
            type: 'approach',
            isRed: dist <= 60,
            dist,
            intensity: 0.95,
            barIndex: this.getBarIndex(dist),
          },
        });
      }
    }

    // ALSF-II: Add red sidebars in the last 300m
    if (hasRedSidebars) {
      for (let dist = 30; dist <= 300; dist += 30) {
        const center = calculatePoint(
          runwayEnd.latitude,
          runwayEnd.longitude,
          dist,
          approachHeading
        );
        for (const side of [-1, 1]) {
          const sidePoint = calculatePoint(center[1], center[0], 7, approachHeading + side * 90);
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: sidePoint },
            properties: {
              type: 'approach',
              isRed: true,
              dist,
              intensity: 0.9,
              barIndex: this.getBarIndex(dist),
            },
          });
        }
      }
    }

    // Sequenced flashers (RAIL) - 5 lights from 450m to 730m
    this.generateRAILLights(features, runwayEnd, approachHeading, 450, 730);
  }

  /**
   * CALVERT - UK approach lighting
   */
  private generateCalvertLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number,
    isCalvert2: boolean
  ): void {
    const totalLength = 900; // meters

    // Centerline lights every 30m
    for (let dist = 30; dist <= totalLength; dist += 30) {
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: {
          type: 'approach',
          isRed: dist <= 90,
          dist,
          intensity: 1.0,
          barIndex: this.getBarIndex(dist),
        },
      });
    }

    // Crossbars at specific distances (UK pattern)
    const crossbarDists = isCalvert2 ? [90, 150, 300, 450, 600, 750] : [150, 300, 450, 600];
    for (const dist of crossbarDists) {
      const center = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      const width = Math.min(dist / 10, 25);

      for (let offset = -width; offset <= width; offset += 3) {
        if (Math.abs(offset) < 3) continue;
        const pt = calculatePoint(
          center[1],
          center[0],
          Math.abs(offset),
          offset < 0 ? approachHeading - 90 : approachHeading + 90
        );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: {
            type: 'approach',
            isRed: false,
            dist,
            intensity: 0.9,
            barIndex: this.getBarIndex(dist),
          },
        });
      }
    }
  }

  /**
   * SSAL/SSALR/SSALF - Simplified short approach lights
   */
  private generateSSALLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number,
    hasRAIL: boolean
  ): void {
    const totalLength = 425; // meters (~1400ft)

    // Centerline barrettes every 60m
    for (let dist = 60; dist <= totalLength; dist += 60) {
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);

      // 3-light barrette
      for (let offset = -3; offset <= 3; offset += 3) {
        const barPoint =
          offset === 0
            ? point
            : calculatePoint(
                point[1],
                point[0],
                Math.abs(offset),
                offset < 0 ? approachHeading - 90 : approachHeading + 90
              );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: barPoint },
          properties: {
            type: 'approach',
            isRed: dist <= 60,
            dist,
            intensity: 1.0,
            barIndex: this.getBarIndex(dist),
          },
        });
      }
    }

    // Threshold bar
    const thresholdBar = calculatePoint(
      runwayEnd.latitude,
      runwayEnd.longitude,
      30,
      approachHeading
    );
    for (let offset = -12; offset <= 12; offset += 3) {
      const pt = calculatePoint(
        thresholdBar[1],
        thresholdBar[0],
        Math.abs(offset),
        offset < 0 ? approachHeading - 90 : approachHeading + 90
      );
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {
          type: 'approach',
          isRed: true,
          dist: 30,
          intensity: 1.0,
          barIndex: this.getBarIndex(30),
        },
      });
    }

    if (hasRAIL) {
      this.generateRAILLights(features, runwayEnd, approachHeading, 425, 730);
    }
  }

  /**
   * MALS/MALSR/MALSF - Medium intensity approach lights
   */
  private generateMALSLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number,
    hasRAIL: boolean
  ): void {
    const totalLength = 425; // meters

    // Centerline barrettes every 60m
    for (let dist = 60; dist <= totalLength; dist += 60) {
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);

      for (let offset = -3; offset <= 3; offset += 3) {
        const barPoint =
          offset === 0
            ? point
            : calculatePoint(
                point[1],
                point[0],
                Math.abs(offset),
                offset < 0 ? approachHeading - 90 : approachHeading + 90
              );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: barPoint },
          properties: {
            type: 'approach',
            isRed: false,
            dist,
            intensity: 0.9,
            barIndex: this.getBarIndex(dist),
          },
        });
      }
    }

    // 3 crossbars at 60, 180, 300m
    for (const dist of [60, 180, 300]) {
      const center = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      for (let offset = -12; offset <= 12; offset += 3) {
        if (Math.abs(offset) < 4) continue;
        const pt = calculatePoint(
          center[1],
          center[0],
          Math.abs(offset),
          offset < 0 ? approachHeading - 90 : approachHeading + 90
        );
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: pt },
          properties: {
            type: 'approach',
            isRed: false,
            dist,
            intensity: 0.85,
            barIndex: this.getBarIndex(dist),
          },
        });
      }
    }

    if (hasRAIL) {
      this.generateRAILLights(features, runwayEnd, approachHeading, 425, 730);
    }
  }

  /**
   * ODALS - Omnidirectional approach light system (5 flashing lights)
   */
  private generateODALSLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number
  ): void {
    // 5 omnidirectional lights at 90m intervals (300ft)
    for (let i = 0; i < 5; i++) {
      const dist = 90 + i * 90; // 90, 180, 270, 360, 450m
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: {
          type: 'approach',
          isRed: false,
          dist,
          intensity: 1.0,
          isFlasher: true,
          barIndex: this.getBarIndex(dist),
        },
      });
    }

    // Runway-end identifier lights (2 at threshold)
    for (const side of [-1, 1]) {
      const pt = calculatePoint(
        runwayEnd.latitude,
        runwayEnd.longitude,
        10,
        approachHeading + side * 90
      );
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {
          type: 'approach',
          isRed: false,
          dist: 0,
          intensity: 1.0,
          isFlasher: true,
          barIndex: 0,
        },
      });
    }
  }

  /**
   * RAIL - Runway Alignment Indicator Lights (sequenced flashers)
   */
  private generateRAILLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number,
    startDist: number = 450,
    endDist: number = 730
  ): void {
    // 5 sequenced flashers
    const spacing = (endDist - startDist) / 4;
    for (let i = 0; i < 5; i++) {
      const dist = startDist + i * spacing;
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: {
          type: 'approach',
          isRed: false,
          dist,
          intensity: 1.0,
          isFlasher: true,
          sequence: i,
          barIndex: this.getBarIndex(dist),
        },
      });
    }
  }

  /**
   * Generic approach lights for unknown types
   */
  private generateGenericApproachLights(
    features: GeoJSON.Feature[],
    runwayEnd: { latitude: number; longitude: number },
    approachHeading: number
  ): void {
    // Simple centerline every 60m for 300m
    for (let dist = 60; dist <= 300; dist += 60) {
      const point = calculatePoint(runwayEnd.latitude, runwayEnd.longitude, dist, approachHeading);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: {
          type: 'approach',
          isRed: dist <= 60,
          dist,
          intensity: 0.8,
          barIndex: this.getBarIndex(dist),
        },
      });
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return haversineDistance(lat1, lon1, lat2, lon2);
  }
}
