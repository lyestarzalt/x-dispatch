import { useTranslation } from 'react-i18next';
import { useUnits } from '@/hooks/useUnits';
import { type Degrees, type NauticalMiles } from '@/lib/utils/geomath';
import type { Navaid } from '@/types/navigation';
import { KvRow } from './KvRow';

export function IlsDetail({ endName, ils, gs }: { endName: string; ils: Navaid; gs?: Navaid }) {
  const { t } = useTranslation();
  const units = useUnits();
  // Navaid frequencies are stored as Hz*100 (e.g. 10950 → 109.50 MHz). Same
  // formatting convention as ILSLayer / NavaidLayer use elsewhere.
  const freq = `${(ils.frequency / 100).toFixed(2)}`;
  // Localizer heading lives on `bearing`; some records carry it on `course`
  // instead, fall back so we don't show an em-dash for those.
  const heading = ils.bearing ?? ils.course;
  // ils.magneticVariation is decoded straight from the earth_nav.dat ILS
  // record (navaidParser.ts) — the station's own published variation, more
  // accurate for this specific course than a live WMM lookup would be.
  const headingStr =
    heading !== undefined
      ? units.courseWithVariation(heading as Degrees, ils.magneticVariation)
      : '—';
  // Glide-slope angle comes from a separate GS Navaid record (joined by
  // associatedRunway). Old parser builds stored the angle ÷100 (e.g. 0.03
  // instead of 3.0); same workaround as ILSLayer.ts uses.
  const rawGs = gs?.glidepathAngle;
  const gsAngle = rawGs !== undefined && rawGs < 0.5 ? rawGs * 100 : rawGs;
  const gsStr = gsAngle !== undefined ? `${gsAngle.toFixed(1)}°` : '—';
  const rangeStr =
    ils.range > 0
      ? t('airportInfo.ils.rangeNm', { value: units.distance(ils.range as NauticalMiles) })
      : '—';
  // Flat block, no inner card — the runway-row container already provides
  // the surface. CDU-page feel: uppercase header with its natural underline,
  // KvRows indented under it.
  return (
    <div className="text-sm">
      <h5 className="text-muted-foreground/70 mb-0.5 text-xs tracking-wider uppercase">
        {t('airportInfo.runwayName', { name: endName })}
      </h5>
      <div className="pl-1">
        <KvRow label={t('airportInfo.ils.frequency')} value={freq} />
        <KvRow label={t('airportInfo.ils.localizer')} value={headingStr} />
        <KvRow label={t('airportInfo.ils.glideslope')} value={gsStr} />
        <KvRow label={t('airportInfo.ils.range')} value={rangeStr} />
        <KvRow label={t('airportInfo.ils.ident')} value={ils.id} />
      </div>
    </div>
  );
}
