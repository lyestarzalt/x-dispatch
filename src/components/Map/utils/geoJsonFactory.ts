import { ParsedAirport } from '@/lib/aptParser';
import { getRunwayPolygon, getRunwayShoulderPolygon } from '@/lib/aptParser/runwayHelper';
import {
  LinearFeature,
  Pavement,
  Runway,
  Sign,
  StartupLocation,
  Windsock,
} from '@/lib/aptParser/types';

export function createRunwayGeoJSON(runways: Runway[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: runways.map((runway) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [getRunwayPolygon(runway)],
      },
      properties: {
        surface: runway.surface_type,
        name: `${runway.ends[0].name}-${runway.ends[1].name}`,
        width: runway.width,
        centerlineLights: runway.centerline_lights,
        edgeLights: runway.edge_lights,
        shoulderSurface: runway.shoulder_surface_type,
        shoulderWidth: runway.shoulder_width,
      },
    })),
  };
}

export function createRunwayShoulderGeoJSON(runways: Runway[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const runway of runways) {
    const polygon = getRunwayShoulderPolygon(runway);
    if (!polygon) continue;

    features.push({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [polygon],
      },
      properties: {
        surface: runway.shoulder_surface_type,
        name: `${runway.ends[0].name}-${runway.ends[1].name} shoulder`,
        runwaySurface: runway.surface_type,
        shoulderWidth: runway.shoulder_width,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function createTaxiwayGeoJSON(
  taxiways: ParsedAirport['taxiways']
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: taxiways.map((taxiway) => {
      const paths = taxiway.paths as { coordinates: [number, number][]; isHole?: boolean }[];

      // First path is always outer, rest are holes (based on X-Plane spec order)
      const outer = paths[0];
      const holes = paths.slice(1);

      const coordinates: [number, number][][] = [];
      if (outer) {
        coordinates.push(outer.coordinates.map(([lon, lat]) => [lon, lat]));
      }
      for (const hole of holes) {
        coordinates.push(hole.coordinates.map(([lon, lat]) => [lon, lat]));
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates,
        },
        properties: {
          surface: taxiway.surface,
          smoothness: taxiway.smoothness,
          orientation: taxiway.orientation,
        },
      };
    }),
  };
}

export function createBoundaryGeoJSON(
  boundaries: ParsedAirport['boundaries']
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: boundaries.map((boundary) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: boundary.paths.map((path: { coordinates: [number, number][] }) =>
          path.coordinates.map(([lon, lat]) => [lon, lat])
        ),
      },
      properties: {},
    })),
  };
}

export function createPavementGeoJSON(pavements: Pavement[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pavements.map((pavement) => {
      // Build coordinates array: outer ring first, then holes
      const coordinates: [number, number][][] = [
        pavement.coordinates.map(([lon, lat]) => [lon, lat]),
      ];

      // Add holes if present
      if (pavement.holes) {
        for (const hole of pavement.holes) {
          coordinates.push(hole.map(([lon, lat]) => [lon, lat]));
        }
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates,
        },
        properties: {
          name: pavement.name,
          surface: pavement.surface_type,
          smoothness: pavement.smoothness,
        },
      };
    }),
  };
}

/**
 * Create GeoJSON FeatureCollection for linear features (painted lines)
 * Filters out lineType 0 (transparent/none) as these should not be rendered
 * Per X-Plane spec: lineType 0 = "Nothing" (no painted line)
 */
export function createLinearFeatureGeoJSON(
  linearFeatures: LinearFeature[]
): GeoJSON.FeatureCollection {
  // Filter out transparent/undefined lines - only include lineType >= 1
  const filtered = linearFeatures.filter((feature) => {
    const lineType = feature.painted_line_type;
    return lineType !== undefined && lineType !== null && lineType >= 1;
  });

  return {
    type: 'FeatureCollection',
    features: filtered.map((feature) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: feature.coordinates.map(([lon, lat]) => [lon, lat]),
      },
      properties: {
        name: feature.name,
        lineType: feature.painted_line_type,
        lightingType: feature.lighting_line_type,
      },
    })),
  };
}

/**
 * Create GeoJSON FeatureCollection for linear feature lighting (as points along line)
 */
export function createLinearFeatureLightingGeoJSON(
  linearFeatures: LinearFeature[]
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const feature of linearFeatures) {
    // Only process features with lighting (skip NONE = 0)
    if ((feature.lighting_line_type as number) === 0) {
      continue;
    }

    // Create points along the line at regular intervals
    const coords = feature.coordinates;
    const lightSpacing = 10; // Create a light every ~10 coordinate pairs

    for (let i = 0; i < coords.length; i += lightSpacing) {
      const [lon, lat] = coords[i];
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties: {
          lightingType: feature.lighting_line_type,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Create GeoJSON FeatureCollection for startup locations
 */
export function createStartupLocationGeoJSON(
  locations: StartupLocation[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: locations.map((location) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [location.longitude, location.latitude],
      },
      properties: {
        name: location.name,
        type: location.location_type,
        heading: location.heading,
        airplaneTypes: location.airplane_types,
      },
    })),
  };
}

/**
 * Create GeoJSON FeatureCollection for windsocks
 */
export function createWindsockGeoJSON(windsocks: Windsock[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: windsocks.map((windsock) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [windsock.longitude, windsock.latitude],
      },
      properties: {
        name: windsock.name,
        illuminated: windsock.illuminated,
      },
    })),
  };
}

/**
 * Create GeoJSON FeatureCollection for signs
 */
export function createSignGeoJSON(signs: Sign[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: signs.map((sign) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [sign.longitude, sign.latitude],
      },
      properties: {
        text: sign.text,
        size: sign.size,
        heading: sign.heading,
      },
    })),
  };
}
