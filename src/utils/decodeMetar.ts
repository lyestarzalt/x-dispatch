export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface WindInfo {
  direction: number | 'VRB';
  speed: number;
  gust?: number;
  unit: 'KT' | 'MPS';
  variable?: { from: number; to: number };
}

export interface CloudLayer {
  cover: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'CLR' | 'SKC' | 'NSC' | 'NCD' | 'VV';
  altitude?: number; // in hundreds of feet
  type?: 'CB' | 'TCU';
}

export interface VisibilityInfo {
  value: number;
  unit: 'SM' | 'M';
  modifier?: 'M' | 'P'; // Less than / Greater than
}

export interface DecodedMETAR {
  raw: string;
  station: string;
  observationTime: Date | null;
  isAuto: boolean;
  wind: WindInfo | null;
  visibility: VisibilityInfo | null;
  weather: string[];
  clouds: CloudLayer[];
  temperature: number | null;
  dewpoint: number | null;
  altimeter: number | null;
  altimeterUnit: 'inHg' | 'hPa';
  remarks: string;
  flightCategory: FlightCategory;
  humanReadable: string;
}

const WEATHER_CODES: Record<string, string> = {
  // Intensity
  '+': 'Heavy',
  '-': 'Light',
  VC: 'Vicinity',

  // Descriptors
  MI: 'Shallow',
  PR: 'Partial',
  BC: 'Patches',
  DR: 'Low Drifting',
  BL: 'Blowing',
  SH: 'Showers',
  TS: 'Thunderstorm',
  FZ: 'Freezing',

  // Precipitation
  DZ: 'Drizzle',
  RA: 'Rain',
  SN: 'Snow',
  SG: 'Snow Grains',
  IC: 'Ice Crystals',
  PL: 'Ice Pellets',
  GR: 'Hail',
  GS: 'Small Hail',
  UP: 'Unknown Precipitation',

  // Obscuration
  BR: 'Mist',
  FG: 'Fog',
  FU: 'Smoke',
  VA: 'Volcanic Ash',
  DU: 'Widespread Dust',
  SA: 'Sand',
  HZ: 'Haze',
  PY: 'Spray',

  // Other
  PO: 'Dust Whirls',
  SQ: 'Squalls',
  FC: 'Funnel Cloud',
  SS: 'Sandstorm',
  DS: 'Duststorm',
};

const CLOUD_COVER: Record<string, string> = {
  CLR: 'Clear',
  SKC: 'Sky Clear',
  NSC: 'No Significant Clouds',
  NCD: 'No Clouds Detected',
  FEW: 'Few',
  SCT: 'Scattered',
  BKN: 'Broken',
  OVC: 'Overcast',
  VV: 'Vertical Visibility',
};

function parseObservationTime(dayTime: string): Date | null {
  const match = dayTime.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const hour = parseInt(match[2], 10);
  const minute = parseInt(match[3], 10);

  const now = new Date();
  const obsTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hour, minute));

  // If observation day is in the future, it's from last month
  if (obsTime > now) {
    obsTime.setUTCMonth(obsTime.getUTCMonth() - 1);
  }

  return obsTime;
}

function parseWind(windStr: string): WindInfo | null {
  // e.g., "31015G25KT", "VRB05KT", "00000KT", "36010MPS"
  const match = windStr.match(/^(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/);
  if (!match) return null;

  return {
    direction: match[1] === 'VRB' ? 'VRB' : parseInt(match[1], 10),
    speed: parseInt(match[2], 10),
    gust: match[4] ? parseInt(match[4], 10) : undefined,
    unit: match[5] as 'KT' | 'MPS',
  };
}

function parseVariableWind(str: string, wind: WindInfo | null): WindInfo | null {
  // e.g., "280V350"
  const match = str.match(/^(\d{3})V(\d{3})$/);
  if (!match || !wind) return wind;

  return {
    ...wind,
    variable: {
      from: parseInt(match[1], 10),
      to: parseInt(match[2], 10),
    },
  };
}

function parseVisibility(visStr: string): VisibilityInfo | null {
  // US format: "10SM", "1/2SM", "M1/4SM", "P6SM"
  let match = visStr.match(/^(M|P)?(\d+)?(\/)?(\d+)?SM$/);
  if (match) {
    let value: number;
    if (match[3] === '/' && match[4]) {
      // Fraction like 1/2 or 1/4
      const numerator = match[2] ? parseInt(match[2], 10) : 1;
      value = numerator / parseInt(match[4], 10);
    } else {
      value = parseInt(match[2] || '10', 10);
    }
    return {
      value,
      unit: 'SM',
      modifier: match[1] as 'M' | 'P' | undefined,
    };
  }

  // Mixed fraction like "2 1/2SM"
  match = visStr.match(/^(\d+)\s+(\d+)\/(\d+)SM$/);
  if (match) {
    const whole = parseInt(match[1], 10);
    const frac = parseInt(match[2], 10) / parseInt(match[3], 10);
    return { value: whole + frac, unit: 'SM' };
  }

  // Metric format: "9999" or "4000"
  match = visStr.match(/^(\d{4})$/);
  if (match) {
    const meters = parseInt(match[1], 10);
    return { value: meters, unit: 'M' };
  }

  return null;
}

function parseWeather(wxStr: string): string {
  let result = '';
  let remaining = wxStr;

  // Check for intensity prefix
  if (remaining.startsWith('+') || remaining.startsWith('-')) {
    result += WEATHER_CODES[remaining[0]] + ' ';
    remaining = remaining.slice(1);
  }

  // Check for VC (vicinity)
  if (remaining.startsWith('VC')) {
    result += WEATHER_CODES['VC'] + ' ';
    remaining = remaining.slice(2);
  }

  // Parse two-letter codes
  while (remaining.length >= 2) {
    const code = remaining.slice(0, 2);
    if (WEATHER_CODES[code]) {
      result += WEATHER_CODES[code] + ' ';
      remaining = remaining.slice(2);
    } else {
      break;
    }
  }

  return result.trim() || wxStr;
}

function parseClouds(cloudStr: string): CloudLayer | null {
  // e.g., "FEW040", "SCT250", "BKN010CB", "OVC005", "VV002"
  const match = cloudStr.match(/^(FEW|SCT|BKN|OVC|VV|CLR|SKC|NSC|NCD)(\d{3})?(CB|TCU)?$/);
  if (!match) return null;

  const layer: CloudLayer = {
    cover: match[1] as CloudLayer['cover'],
  };

  if (match[2]) {
    layer.altitude = parseInt(match[2], 10);
  }

  if (match[3]) {
    layer.type = match[3] as 'CB' | 'TCU';
  }

  return layer;
}

function parseTemperature(tempStr: string): { temp: number; dew: number } | null {
  // e.g., "M02/M14", "15/10", "M05/M10"
  const match = tempStr.match(/^(M)?(\d{2})\/(M)?(\d{2})$/);
  if (!match) return null;

  let temp = parseInt(match[2], 10);
  if (match[1] === 'M') temp = -temp;

  let dew = parseInt(match[4], 10);
  if (match[3] === 'M') dew = -dew;

  return { temp, dew };
}

function parseAltimeter(altStr: string): { value: number; unit: 'inHg' | 'hPa' } | null {
  // US: "A3042" (30.42 inHg), International: "Q1013" (1013 hPa)
  const matchA = altStr.match(/^A(\d{4})$/);
  if (matchA) {
    return { value: parseInt(matchA[1], 10) / 100, unit: 'inHg' };
  }

  const matchQ = altStr.match(/^Q(\d{4})$/);
  if (matchQ) {
    return { value: parseInt(matchQ[1], 10), unit: 'hPa' };
  }

  return null;
}

function determineFlightCategory(
  visibility: VisibilityInfo | null,
  clouds: CloudLayer[]
): FlightCategory {
  // Convert visibility to statute miles
  let visSM: number | null = null;
  if (visibility) {
    if (visibility.unit === 'SM') {
      visSM = visibility.value;
      if (visibility.modifier === 'M') visSM = visibility.value - 0.01;
      if (visibility.modifier === 'P') visSM = visibility.value + 0.01;
    } else {
      // Convert meters to statute miles
      visSM = visibility.value / 1609.34;
    }
  }

  // Find ceiling (lowest BKN or OVC)
  let ceiling: number | null = null;
  for (const cloud of clouds) {
    if (
      (cloud.cover === 'BKN' || cloud.cover === 'OVC' || cloud.cover === 'VV') &&
      cloud.altitude
    ) {
      const altFeet = cloud.altitude * 100;
      if (ceiling === null || altFeet < ceiling) {
        ceiling = altFeet;
      }
    }
  }

  // Determine category
  // LIFR: Ceiling < 500ft or Visibility < 1SM
  if ((ceiling !== null && ceiling < 500) || (visSM !== null && visSM < 1)) {
    return 'LIFR';
  }

  // IFR: Ceiling 500-999ft or Visibility 1-3SM
  if ((ceiling !== null && ceiling < 1000) || (visSM !== null && visSM < 3)) {
    return 'IFR';
  }

  // MVFR: Ceiling 1000-3000ft or Visibility 3-5SM
  if ((ceiling !== null && ceiling <= 3000) || (visSM !== null && visSM <= 5)) {
    return 'MVFR';
  }

  return 'VFR';
}

function generateHumanReadable(metar: DecodedMETAR): string {
  const parts: string[] = [];

  // Wind
  if (metar.wind) {
    let windStr = '';
    if (metar.wind.direction === 'VRB') {
      windStr = `Variable winds at ${metar.wind.speed}`;
    } else if (metar.wind.speed === 0) {
      windStr = 'Calm winds';
    } else {
      windStr = `Wind from ${metar.wind.direction.toString().padStart(3, '0')}° at ${metar.wind.speed}`;
    }
    if (metar.wind.gust) {
      windStr += `, gusting ${metar.wind.gust}`;
    }
    windStr += metar.wind.unit === 'KT' ? ' knots' : ' m/s';
    if (metar.wind.variable) {
      windStr += ` (variable ${metar.wind.variable.from}°-${metar.wind.variable.to}°)`;
    }
    parts.push(windStr);
  }

  // Visibility
  if (metar.visibility) {
    let visStr = '';
    if (metar.visibility.modifier === 'M') visStr = 'Less than ';
    if (metar.visibility.modifier === 'P') visStr = 'Greater than ';
    if (metar.visibility.unit === 'SM') {
      if (metar.visibility.value >= 10) {
        visStr += '10+ miles visibility';
      } else if (metar.visibility.value >= 1) {
        visStr += `${metar.visibility.value} mile${metar.visibility.value !== 1 ? 's' : ''} visibility`;
      } else {
        visStr += `${metar.visibility.value} mile visibility`;
      }
    } else {
      if (metar.visibility.value >= 9999) {
        visStr += 'Unlimited visibility';
      } else {
        visStr += `${metar.visibility.value} meters visibility`;
      }
    }
    parts.push(visStr);
  }

  // Weather
  if (metar.weather.length > 0) {
    parts.push(metar.weather.join(', '));
  }

  // Clouds
  if (metar.clouds.length > 0) {
    const cloudParts = metar.clouds.map((c) => {
      if (c.cover === 'CLR' || c.cover === 'SKC') return 'Clear skies';
      if (c.cover === 'NSC' || c.cover === 'NCD') return 'No significant clouds';
      const coverName = CLOUD_COVER[c.cover] || c.cover;
      const alt = c.altitude ? ` at ${(c.altitude * 100).toLocaleString()}ft` : '';
      const type =
        c.type === 'CB' ? ' (cumulonimbus)' : c.type === 'TCU' ? ' (towering cumulus)' : '';
      return `${coverName}${alt}${type}`;
    });
    parts.push(cloudParts.join(', '));
  }

  // Temperature
  if (metar.temperature !== null) {
    parts.push(`Temperature ${metar.temperature}°C`);
  }
  if (metar.dewpoint !== null) {
    parts.push(`Dewpoint ${metar.dewpoint}°C`);
  }

  // Altimeter
  if (metar.altimeter !== null) {
    if (metar.altimeterUnit === 'inHg') {
      parts.push(`Altimeter ${metar.altimeter.toFixed(2)} inHg`);
    } else {
      parts.push(`Altimeter ${metar.altimeter} hPa`);
    }
  }

  return parts.join('. ') + '.';
}

export function decodeMetar(raw: string): DecodedMETAR {
  const parts = raw.trim().split(/\s+/);
  let idx = 0;

  const metar: DecodedMETAR = {
    raw,
    station: '',
    observationTime: null,
    isAuto: false,
    wind: null,
    visibility: null,
    weather: [],
    clouds: [],
    temperature: null,
    dewpoint: null,
    altimeter: null,
    altimeterUnit: 'inHg',
    remarks: '',
    flightCategory: 'VFR',
    humanReadable: '',
  };

  // Skip METAR/SPECI prefix if present
  if (parts[idx] === 'METAR' || parts[idx] === 'SPECI') {
    idx++;
  }

  // Station identifier (4 letters)
  if (parts[idx] && /^[A-Z]{4}$/.test(parts[idx])) {
    metar.station = parts[idx];
    idx++;
  }

  // Observation time (DDHHMM Z)
  if (parts[idx] && /^\d{6}Z$/.test(parts[idx])) {
    metar.observationTime = parseObservationTime(parts[idx]);
    idx++;
  }

  // AUTO indicator
  if (parts[idx] === 'AUTO') {
    metar.isAuto = true;
    idx++;
  }

  // Wind
  if (parts[idx] && /^(VRB|\d{3})\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(parts[idx])) {
    metar.wind = parseWind(parts[idx]);
    idx++;

    // Variable wind direction
    if (parts[idx] && /^\d{3}V\d{3}$/.test(parts[idx])) {
      metar.wind = parseVariableWind(parts[idx], metar.wind);
      idx++;
    }
  }

  // Visibility
  if (parts[idx]) {
    // Check for "1 1/2SM" style (two parts)
    if (/^\d+$/.test(parts[idx]) && parts[idx + 1] && /^\d+\/\d+SM$/.test(parts[idx + 1])) {
      const vis = parseVisibility(`${parts[idx]} ${parts[idx + 1]}`);
      if (vis) {
        metar.visibility = vis;
        idx += 2;
      }
    } else {
      const vis = parseVisibility(parts[idx]);
      if (vis) {
        metar.visibility = vis;
        idx++;
      } else if (/^\d{4}$/.test(parts[idx])) {
        // Metric visibility (4 digits)
        metar.visibility = { value: parseInt(parts[idx], 10), unit: 'M' };
        idx++;
      }
    }
  }

  // Weather phenomena (can be multiple)
  while (parts[idx] && /^[-+]?VC?[A-Z]{2,}$/.test(parts[idx])) {
    metar.weather.push(parseWeather(parts[idx]));
    idx++;
  }

  // Clouds (can be multiple)
  while (parts[idx]) {
    const cloud = parseClouds(parts[idx]);
    if (cloud) {
      metar.clouds.push(cloud);
      idx++;
    } else {
      break;
    }
  }

  // Temperature/Dewpoint
  if (parts[idx] && /^M?\d{2}\/M?\d{2}$/.test(parts[idx])) {
    const temps = parseTemperature(parts[idx]);
    if (temps) {
      metar.temperature = temps.temp;
      metar.dewpoint = temps.dew;
    }
    idx++;
  }

  // Altimeter
  if (parts[idx] && /^[AQ]\d{4}$/.test(parts[idx])) {
    const alt = parseAltimeter(parts[idx]);
    if (alt) {
      metar.altimeter = alt.value;
      metar.altimeterUnit = alt.unit;
    }
    idx++;
  }

  // Everything after RMK is remarks
  const rmkIdx = parts.indexOf('RMK');
  if (rmkIdx !== -1) {
    metar.remarks = parts.slice(rmkIdx + 1).join(' ');
  }

  // Determine flight category
  metar.flightCategory = determineFlightCategory(metar.visibility, metar.clouds);

  // Generate human-readable summary
  metar.humanReadable = generateHumanReadable(metar);

  return metar;
}

/**
 * Calculate wind components for a runway
 */
export function calculateWindComponents(
  windDirection: number,
  windSpeed: number,
  runwayHeading: number
): { headwind: number; crosswind: number; crosswindDirection: 'L' | 'R' } {
  // Convert to radians
  const windAngle = (windDirection * Math.PI) / 180;
  const runwayAngle = (runwayHeading * Math.PI) / 180;

  // Relative wind angle (from runway perspective)
  const relativeAngle = windAngle - runwayAngle;

  // Headwind component (positive = headwind, negative = tailwind)
  const headwind = Math.round(windSpeed * Math.cos(relativeAngle));

  // Crosswind component (always positive, direction indicates side)
  const crosswindRaw = windSpeed * Math.sin(relativeAngle);
  const crosswind = Math.abs(Math.round(crosswindRaw));
  const crosswindDirection: 'L' | 'R' = crosswindRaw < 0 ? 'L' : 'R';

  return { headwind, crosswind, crosswindDirection };
}
