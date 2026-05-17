import { SIA_PRODUCT_CATALOG, getCatalogProduct } from './catalog';
import { searchDownloadableProducts, type SiaDownloadableProductRef } from './siaGraphqlClient';
import type { SiaProduct, SiaProductKind } from './types';

const DISCOVERY_QUERIES: Array<{ kind: SiaProductKind; match: string }> = [
  { kind: 'eaip-full', match: 'ZIP eAIP Complet' },
  { kind: 'vac-amdt-metro', match: 'AMDT VAC FR' },
  { kind: 'vac-amdt-heli', match: 'AMDT VAC H' },
];

let cachedRefs: Map<SiaProductKind, SiaDownloadableProductRef> | null = null;
let cacheFetchedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function inferKindFromSku(sku: string, name: string): SiaProductKind | null {
  const s = `${sku} ${name}`.toUpperCase();
  if (s.includes('ZIP EAIP COMPLET') || s.includes('EAIP COMPLET')) return 'eaip-full';
  if (s.includes('AMDT VAC H') || s.includes('HÉLISTATION') || s.includes('HELISTATION')) {
    return 'vac-amdt-heli';
  }
  if (s.includes('AMDT VAC FR') || (s.includes('AMDT VAC') && s.includes('MÉTROPOL'))) {
    return 'vac-amdt-metro';
  }
  return null;
}

function parseAiracCycle(sku: string, name: string): string | null {
  const text = `${sku} ${name}`;
  const airac = text.match(/AIRAC\s+(\d{2}\/\d{2})/i);
  if (airac) return airac[1]!;
  const nonAirac = text.match(/NON\s+AIRAC\s+(\d{2}\/\d{2})/i);
  if (nonAirac) return nonAirac[1]!;
  return null;
}

export async function discoverMagentoRefs(
  force = false
): Promise<Map<SiaProductKind, SiaDownloadableProductRef>> {
  const now = Date.now();
  if (!force && cachedRefs && now - cacheFetchedAt < CACHE_TTL_MS) {
    return cachedRefs;
  }

  const byKind = new Map<SiaProductKind, SiaDownloadableProductRef>();

  for (const { kind, match } of DISCOVERY_QUERIES) {
    const items = await searchDownloadableProducts(match, 6);
    const picked =
      items.find((i) => inferKindFromSku(i.sku, i.name) === kind) ??
      items[0];
    if (picked) byKind.set(kind, picked);
  }

  // Broader fallback for eAIP if narrow match failed
  if (!byKind.has('eaip-full')) {
    const eaipItems = await searchDownloadableProducts('eAIP', 10);
    const full = eaipItems.find((i) => inferKindFromSku(i.sku, i.name) === 'eaip-full');
    if (full) byKind.set('eaip-full', full);
  }

  cachedRefs = byKind;
  cacheFetchedAt = now;
  return byKind;
}

export async function resolveMagentoProduct(
  productId: string
): Promise<(SiaProduct & { magento: SiaDownloadableProductRef }) | null> {
  const product = getCatalogProduct(productId);
  if (!product) return null;

  const refs = await discoverMagentoRefs();
  const magento = refs.get(product.kind);
  if (!magento) return null;

  return { ...product, magento };
}

export async function enrichCatalogWithDiscovery(): Promise<SiaProduct[]> {
  const refs = await discoverMagentoRefs();
  return SIA_PRODUCT_CATALOG.map((p) => {
    const magento = refs.get(p.kind);
    const discoveredCycle = magento ? parseAiracCycle(magento.sku, magento.name) : null;
    return {
      ...p,
      magentoSku: magento?.sku,
      downloadableLinkId: magento?.linkId,
      airacCycle: discoveredCycle ?? p.airacCycle,
    };
  });
}

export function clearDiscoveryCache(): void {
  cachedRefs = null;
  cacheFetchedAt = 0;
}
