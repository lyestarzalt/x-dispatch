import type { SiaProduct } from './types';

/**
 * Product catalog — update downloadUrl each AIRAC cycle when SIA publishes new links.
 * Users can always import a local ZIP via Settings if the URL is stale.
 */
export const SIA_PRODUCT_CATALOG: readonly SiaProduct[] = [
  {
    id: 'eaip-full-05-26',
    kind: 'eaip-full',
    nameKey: 'sia.products.eaipFull',
    pageUrl:
      'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition/eaip/zip-eaip-complet-airac-05-26.html',
    airacCycle: '05/26',
    validFrom: '2026-05-14',
    validTo: '2026-06-10',
    sizeBytes: 1_030_000_000,
  },
  {
    id: 'vac-amdt-metro-06-26',
    kind: 'vac-amdt-metro',
    nameKey: 'sia.products.vacAmdtMetro',
    pageUrl:
      'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition/eaip/amendement-vac-france-metropolitaine-non-airac-06-26.html',
    airacCycle: '06/26',
    validFrom: '2026-05-14',
    validTo: '2026-06-10',
    sizeBytes: 4_400_000,
  },
  {
    id: 'vac-amdt-heli-06-26',
    kind: 'vac-amdt-heli',
    nameKey: 'sia.products.vacAmdtHeli',
    pageUrl:
      'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition/eaip/amendement-vac-helistations-france-metropolitaine-non-airac-06-26.html',
    airacCycle: '06/26',
    validFrom: '2026-05-14',
    validTo: '2026-06-10',
    sizeBytes: 342_000,
  },
] as const;

/** Manual import of VAC PDFs (ZIP or folder) from any country. */
export const VAC_IMPORT_PRODUCT: SiaProduct = {
  id: 'vac-import',
  kind: 'vac-import',
  nameKey: 'sia.products.vacImport',
  pageUrl: '',
  airacCycle: 'manual',
  validFrom: '',
  validTo: '',
};

export function getCatalogProduct(productId: string): SiaProduct | undefined {
  if (productId === VAC_IMPORT_PRODUCT.id) return VAC_IMPORT_PRODUCT;
  return SIA_PRODUCT_CATALOG.find((p) => p.id === productId);
}

export function getLatestCatalogCycle(): string {
  return SIA_PRODUCT_CATALOG[0]?.airacCycle ?? '';
}

export function getFullEaipProduct(): SiaProduct | undefined {
  return SIA_PRODUCT_CATALOG.find((p) => p.kind === 'eaip-full');
}
