/**
 * Centralized formatting utilities
 */

// ============================================================================
// ALTITUDE FORMATTING
// ============================================================================

/**
 * Format altitude in feet, using flight levels for high altitudes
 * @param feet Altitude in feet
 * @param flThreshold Threshold above which to use FL notation (default 18000)
 */
function formatAltitude(feet: number, flThreshold = 18000): string {
  if (feet >= flThreshold) {
    return `FL${Math.round(feet / 100)}`;
  }
  return `${feet.toLocaleString()}ft`;
}

/**
 * Format altitude with apostrophe notation (e.g., "3,940'")
 */
function formatAltitudePrime(feet: number): string {
  return `${Math.round(feet).toLocaleString()}'`;
}

/**
 * Format altitude for display with optional FL conversion
 */
export function formatTransitionAltitude(feet: number): string {
  if (feet >= 18000) {
    return `FL${Math.round(feet / 100)}`;
  }
  return `${feet.toLocaleString()}ft`;
}

/**
 * Format ceiling altitude (hundreds of feet)
 */
function formatCeilingAltitude(feet: number): string {
  const hundreds = Math.round(feet / 100);
  return `${hundreds * 100}ft`;
}

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format decimal hours to HH:MM string
 */
export function formatTime(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format time with timezone label
 */
function formatTimeWithZone(decimalHours: number, tzLabel: string): string {
  return `${formatTime(decimalHours)} ${tzLabel}`;
}

/**
 * Format time in Zulu/UTC format
 */
export function formatZulu(decimalHours: number): string {
  return `${formatTime(decimalHours)}Z`;
}

/**
 * Format time from Date object
 */
function formatTimeFromDate(date: Date, hour12 = false): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format date in short format (e.g., "Jan 15")
 */
function formatDateShort(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/**
 * Format date in ISO format (YYYY-MM-DD)
 */
function formatDateISO(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toISOString().split('T')[0];
}

// ============================================================================
// FREQUENCY FORMATTING
// ============================================================================

/**
 * Format a radio frequency for display
 */
export function formatFrequency(freq: number, decimals = 3): string {
  return freq.toFixed(decimals);
}

/**
 * Format a navaid frequency (handles VOR vs NDB differences)
 */
function formatNavaidFrequency(freq: number, type: 'VOR' | 'NDB' | 'DME' | 'ILS' | string): string {
  // NDBs use kHz, VORs/ILS use MHz
  if (type === 'NDB') {
    return `${Math.round(freq)} kHz`;
  }
  return `${freq.toFixed(2)} MHz`;
}

// ============================================================================
// DISTANCE FORMATTING
// ============================================================================

/**
 * Format distance in feet
 */
function formatDistanceFeet(feet: number): string {
  return `${Math.round(feet).toLocaleString()}ft`;
}

/**
 * Format distance in meters
 */
function formatDistanceMeters(meters: number): string {
  return `${Math.round(meters).toLocaleString()}m`;
}

/**
 * Format distance in nautical miles
 */
function formatDistanceNm(nm: number, decimals = 1): string {
  return `${nm.toFixed(decimals)}nm`;
}

/**
 * Format runway length (typically in feet)
 */
function formatRunwayLength(feet: number): string {
  return `${Math.round(feet).toLocaleString()}ft`;
}

// ============================================================================
// WEATHER FORMATTING
// ============================================================================

/**
 * Format wind direction and speed
 */
function formatWind(
  direction: number | string | null | undefined,
  speed: number | null | undefined,
  gust?: number | null,
  unit = 'kt'
): string {
  if (direction === null || direction === undefined || speed === null || speed === undefined) {
    return '-';
  }

  // Handle variable wind
  if (direction === 'VRB' || direction === 0) {
    if (gust) {
      return `VRB/${speed}G${gust}${unit}`;
    }
    return `VRB/${speed}${unit}`;
  }

  const dir = typeof direction === 'string' ? parseInt(direction) : direction;
  const dirStr = dir.toString().padStart(3, '0');

  if (gust) {
    return `${dirStr}°/${speed}G${gust}${unit}`;
  }
  return `${dirStr}°/${speed}${unit}`;
}

/**
 * Format visibility
 */
function formatVisibility(
  value: number | null | undefined,
  unit: 'SM' | 'M' = 'SM',
  modifier?: 'P' | 'M' | null
): string {
  if (value === null || value === undefined) return '-';

  const prefix = modifier === 'P' ? '>' : modifier === 'M' ? '<' : '';

  if (unit === 'M') {
    if (value >= 9999) return `${prefix}10+ km`;
    if (value >= 1000) return `${prefix}${(value / 1000).toFixed(1)} km`;
    return `${prefix}${value}m`;
  }

  // Statute miles
  if (value >= 10) return `${prefix}10+ SM`;
  return `${prefix}${value} SM`;
}

// ============================================================================
// COORDINATE FORMATTING
// ============================================================================

/**
 * Format latitude/longitude in decimal degrees
 */
function formatCoordinate(value: number, decimals = 6): string {
  return value.toFixed(decimals);
}

/**
 * Format latitude with N/S suffix
 */
function formatLatitude(lat: number, decimals = 4): string {
  const suffix = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(decimals)}°${suffix}`;
}

/**
 * Format longitude with E/W suffix
 */
function formatLongitude(lon: number, decimals = 4): string {
  const suffix = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(decimals)}°${suffix}`;
}

/**
 * Format coordinates as a pair
 */
function formatCoordinates(lat: number, lon: number, decimals = 4): string {
  return `${formatLatitude(lat, decimals)}, ${formatLongitude(lon, decimals)}`;
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format a number with thousands separator
 */
function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Format a number with specified decimal places
 */
function formatDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Format heading/bearing (3 digits with leading zeros)
 */
function formatHeading(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized).toString().padStart(3, '0') + '°';
}
