/** SIA chart product types distributed via eAIP. */
export type SiaProductKind = 'eaip-full' | 'vac-amdt-metro' | 'vac-amdt-heli' | 'vac-import';

export interface SiaProduct {
  id: string;
  kind: SiaProductKind;
  nameKey: string;
  /** Product page on sia.aviation-civile.gouv.fr (user can download manually). */
  pageUrl: string;
  /** Optional direct download URL when known for the current AIRAC cycle. */
  downloadUrl?: string;
  /** Magento SKU (discovered via GraphQL). */
  magentoSku?: string;
  /** Downloadable link id for Magento cart (discovered via GraphQL). */
  downloadableLinkId?: number;
  airacCycle: string;
  validFrom: string;
  validTo: string;
  sizeBytes?: number;
}

export interface VacChartEntry {
  icao: string;
  pdfPath: string;
  /** Path relative to product extract root (relocatable across machines). */
  pdfRelPath?: string;
  chartId: string;
  chartType: 'vac' | 'iac' | 'other';
  cycle: string;
  validFrom: string;
  validTo: string;
}

export interface SiaInstallManifest {
  version: 1;
  installedProducts: Record<
    string,
    {
      productId: string;
      cycle: string;
      installedAt: number;
      extractPath: string;
      zipPath?: string;
    }
  >;
  /** Atlas-VAC approach plates (PDF_AIPparSSection/VAC/AD), keyed by ICAO. */
  vacIndex: Record<string, VacChartEntry>;
  /** eAIP aerodrome charts (html/eAIP/AD), keyed by ICAO. */
  aipIndex: Record<string, VacChartEntry>;
  cycle: string | null;
  installedAt: number | null;
}

export interface SiaInstallStatus {
  hasData: boolean;
  cycle: string | null;
  installedAt: number | null;
  vacCount: number;
  aipCount: number;
  diskUsageBytes: number;
  products: Array<{
    productId: string;
    cycle: string;
    installedAt: number;
  }>;
  updateAvailable: boolean;
  latestCatalogCycle: string;
}

export interface SiaDownloadProgress {
  productId: string;
  phase: 'downloading' | 'extracting' | 'indexing' | 'done' | 'error';
  percent: number;
  message: string;
}

export interface VacGeorefCorners {
  /** MapLibre image source order: top-left, top-right, bottom-right, bottom-left */
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  source: 'sidecar' | 'apt' | 'default';
}

export interface VacChartInfo extends VacChartEntry {
  georef: VacGeorefCorners | null;
  pngCachePath: string | null;
}
