/**
 * Formatters for `metar-taf-parser` outputs.
 *
 * One canonical implementation, three presentation styles selected per call:
 *   - compact (default): METAR-like, terse — used by OFP weather strips.
 *     Examples: "230°/8kt", ">10SM", "BKN080", "29.89\"".
 *   - verbose: spaced + unit-suffixed for casual readers. Used by the airport
 *     info panel. Examples: "230° / 8 kt", ">10 SM", "BKN 8,000 ft".
 *   - bare: strips trailing units entirely. Used by the in-flight HUD where a
 *     column header already names the unit. Wins over `verbose` if both are set.
 *
 * Note: `metar-taf-parser` returns cloud heights and vertical visibility
 * already in feet (it pre-multiplies by 100 during parsing). The compact
 * formatter divides by 100 to get back the METAR three-digit form.
 */
import { CloudQuantity, DistanceUnit, Intensity } from 'metar-taf-parser';
import type { IAltimeter, ICloud, IWeatherCondition, IWind, Visibility } from 'metar-taf-parser';

export interface FormatOptions {
  /** Use spaces + verbose units ("230° / 8 kt") instead of METAR-like ("230°/8kt"). */
  verbose?: boolean;
  /** Strip trailing unit suffixes entirely. Wins over `verbose` when both set. */
  bare?: boolean;
}

/** Format wind direction + speed (and gust). Returns "CALM" / "VRB" when applicable. */
export function formatWind(wind: IWind | undefined, opts: FormatOptions = {}): string {
  if (!wind) return '—';
  if (wind.speed === 0) return 'CALM';
  const dir = wind.degrees !== undefined ? `${String(wind.degrees).padStart(3, '0')}°` : 'VRB';
  const gust = wind.gust ? `G${wind.gust}` : '';
  if (opts.bare) return `${dir}/${wind.speed}${gust}`;
  if (opts.verbose) return `${dir} / ${wind.speed}${gust} kt`;
  return `${dir}/${wind.speed}${gust}kt`;
}

/** Format prevailing visibility, with CAVOK shortcut when set. */
export function formatVisibility(
  vis: Visibility | undefined,
  cavok?: true,
  opts: FormatOptions = {}
): string {
  if (cavok) return 'CAVOK';
  if (!vis) return '—';
  const isSM = vis.unit === DistanceUnit.StatuteMiles;
  if (isSM) {
    const num = vis.value >= 10 ? '>10' : `${vis.value}`;
    if (opts.bare) return num;
    return opts.verbose ? `${num} SM` : `${num}SM`;
  }
  const num = vis.value >= 9999 ? '>10' : (vis.value / 1000).toFixed(1);
  if (opts.bare) return num;
  return opts.verbose ? `${num} km` : `${num}km`;
}

/**
 * Pick the reportable ceiling from cloud layers + vertical visibility.
 * Compact: METAR-style three-digit hundreds-of-feet ("BKN080").
 * Verbose: human-readable feet ("BKN 8,000 ft").
 */
export function formatCeiling(
  clouds: ICloud[],
  verticalVisibility?: number,
  opts: FormatOptions = {}
): string {
  if (verticalVisibility !== undefined) {
    if (opts.verbose) return `VV ${verticalVisibility.toLocaleString()} ft`;
    return `VV${String(Math.round(verticalVisibility / 100)).padStart(3, '0')}`;
  }
  for (const cloud of clouds) {
    if (
      (cloud.quantity === CloudQuantity.BKN || cloud.quantity === CloudQuantity.OVC) &&
      cloud.height !== undefined
    ) {
      return formatCloudLayer(cloud.quantity, cloud.height, opts);
    }
  }
  const hasClear = clouds.some(
    (c) => c.quantity === CloudQuantity.SKC || c.quantity === CloudQuantity.NSC
  );
  if (hasClear || clouds.length === 0) return opts.verbose ? 'Clear' : 'CLR';
  const lowest = clouds[0];
  if (lowest?.height !== undefined) {
    return formatCloudLayer(lowest.quantity, lowest.height, opts);
  }
  return '—';
}

function formatCloudLayer(quantity: CloudQuantity, height: number, opts: FormatOptions): string {
  if (opts.verbose) return `${quantity} ${height.toLocaleString()} ft`;
  return `${quantity}${String(Math.round(height / 100)).padStart(3, '0')}`;
}

/**
 * Altimeter setting. Compact stays as terse units, verbose adds full unit name.
 * `bare` strips trailing units entirely (used by the in-flight HUD where a
 * column header already says the unit).
 */
export function formatAltimeter(alt: IAltimeter | undefined, opts: FormatOptions = {}): string {
  if (!alt) return '—';
  const isInHg = alt.unit === 'inHg';
  const value = isInHg ? alt.value.toFixed(2) : `${alt.value}`;
  if (opts.bare) return value;
  if (isInHg) return opts.verbose ? `${value} "Hg` : `${value}"`;
  return opts.verbose ? `${value} hPa` : `${value}hPa`;
}

/**
 * Format the present-weather phenomena into the standard METAR-codes
 * string ("-RA", "+TSRA", "VCFG", etc.). Same in all styles.
 */
export function formatWeatherConditions(conditions: IWeatherCondition[]): string {
  return conditions
    .map((c) => {
      let str = '';
      if (c.intensity === Intensity.LIGHT) str += '-';
      else if (c.intensity === Intensity.HEAVY) str += '+';
      else if (c.intensity === Intensity.IN_VICINITY) str += 'VC';
      if (c.descriptive) str += c.descriptive;
      str += c.phenomenons.join('');
      return str;
    })
    .join(' ');
}
