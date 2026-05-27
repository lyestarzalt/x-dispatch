/**
 * Probe SIA Magento free-downloadable flow (dev script).
 */
const BASE = 'https://www.sia.aviation-civile.gouv.fr';
const PAGE_URL = `${BASE}/produits-numeriques-en-libre-disposition/eaip/amendement-vac-helistations-france-metropolitaine-non-airac-06-26.html`;

const jar = new Map();

function parseSetCookie(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const part = line.split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function fetchUrl(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'User-Agent': 'X-Dispatch-SIA/1.0',
      Accept: 'text/html,application/xhtml+xml,application/json',
      ...(opts.headers ?? {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    redirect: 'follow',
  });
  parseSetCookie(res.headers);
  const text = await res.text();
  return { res, text };
}

function extract(html, re) {
  const m = html.match(re);
  return m?.[1] ?? null;
}

async function addToCart(page, productId, formKey) {
  const action =
    extract(page, /action="(https:\/\/[^"]*checkout\/cart\/add[^"]*)"/) ??
    `${BASE}/checkout/cart/add/product/${productId}/`;
  const body = new URLSearchParams({
    product: productId,
    selected_configurable_option: '',
    related_product: '',
    item: productId,
    form_key: formKey,
    qty: '1',
  });
  return fetchUrl(action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: PAGE_URL,
    },
    body: body.toString(),
  });
}

async function main() {
  const { text: page } = await fetchUrl(PAGE_URL);
  const formKey = extract(page, /name="form_key"\s+type="hidden"\s+value="([^"]+)"/);
  const productId = extract(page, /data-product-id="(\d+)"/);
  console.log('product', productId);

  await addToCart(page, productId, formKey);

  const { text: cart } = await fetchUrl(`${BASE}/checkout/cart/`);
  const hasItem = cart.includes('amendement') || cart.includes('Hélistation') || cart.includes('helistation');
  console.log('cart has item?', hasItem);

  // Guest checkout — shipping step (virtual product may skip)
  const { text: checkout } = await fetchUrl(`${BASE}/checkout/`);
  const cfgMatch = checkout.match(/window\.checkoutConfig\s*=\s*(\{[\s\S]*?\n\s*\});/);
  if (!cfgMatch) {
    console.log('no checkoutConfig');
    return;
  }
  const cfg = JSON.parse(cfgMatch[1]);
  console.log('quoteId', cfg.quoteId, 'isGuestCheckoutAllowed', cfg.isGuestCheckoutAllowed);
  console.log('totals', cfg.totalsData?.grand_total);

  // REST guest cart place order (common Magento pattern)
  const restBase = `${BASE}/rest/default/V1`;
  const endpoints = [
    `${restBase}/guest-carts`,
    `${BASE}/rest/V1/guest-carts`,
  ];
  for (const ep of endpoints) {
    const { res, text } = await fetchUrl(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    console.log('POST', ep, res.status, text.slice(0, 120));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
