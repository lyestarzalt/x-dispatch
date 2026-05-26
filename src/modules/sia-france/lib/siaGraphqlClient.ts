import logger from '@/lib/utils/logger';

export const SIA_GRAPHQL_URL = 'https://www.sia.aviation-civile.gouv.fr/graphql';

export interface SiaMagentoCredentials {
  email: string;
  password: string;
}

export interface SiaDownloadableProductRef {
  sku: string;
  linkId: number;
  name: string;
}

interface GqlError {
  message: string;
}

interface GqlResponse<T> {
  data?: T;
  errors?: GqlError[];
}

async function gqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string
): Promise<{ data: T | null; errors: GqlError[] | null }> {
  const res = await fetch(SIA_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GqlResponse<T>;
  if (json.errors?.length) {
    logger.main.warn('SIA GraphQL errors', json.errors);
    return { data: json.data ?? null, errors: json.errors };
  }
  return { data: json.data ?? null, errors: null };
}

export function encodeDownloadableLinkOption(linkId: number): string {
  return Buffer.from(`downloadable/${linkId}`).toString('base64');
}

export async function loginCustomer(
  credentials: SiaMagentoCredentials
): Promise<{ token: string } | { error: string }> {
  const { data, errors } = await gqlRequest<{
    generateCustomerToken: { token: string } | null;
  }>(
    `mutation Login($email: String!, $password: String!) {
      generateCustomerToken(email: $email, password: $password) {
        token
      }
    }`,
    { email: credentials.email.trim(), password: credentials.password }
  );

  const token = data?.generateCustomerToken?.token;
  if (token) return { token };

  const msg = errors?.[0]?.message ?? 'Login failed';
  return { error: msg };
}

export async function searchDownloadableProducts(
  nameMatch: string,
  pageSize = 12
): Promise<SiaDownloadableProductRef[]> {
  const { data, errors } = await gqlRequest<{
    products: {
      items: Array<{
        sku: string;
        name: string;
        __typename: string;
        downloadable_product_links?: Array<{ id: number; title: string }>;
      }>;
    };
  }>(
    `query Products($match: String!, $pageSize: Int!) {
      products(filter: { name: { match: $match } }, pageSize: $pageSize) {
        items {
          sku
          name
          __typename
          ... on DownloadableProduct {
            downloadable_product_links { id title }
          }
        }
      }
    }`,
    { match: nameMatch, pageSize }
  );

  if (errors || !data?.products?.items) return [];

  return data.products.items
    .filter((p) => p.__typename === 'DownloadableProduct' && p.downloadable_product_links?.length)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      linkId: p.downloadable_product_links![0]!.id,
    }));
}

export async function purchaseAndGetDownloadUrl(
  credentials: SiaMagentoCredentials,
  product: SiaDownloadableProductRef
): Promise<{ downloadUrl: string } | { error: string }> {
  const login = await loginCustomer(credentials);
  if ('error' in login) return login;

  const token = login.token;

  const cartRes = await gqlRequest<{ createEmptyCart: string }>(
    `mutation { createEmptyCart }`,
    {},
    token
  );
  const cartId = cartRes.data?.createEmptyCart;
  if (!cartId) {
    return { error: cartRes.errors?.[0]?.message ?? 'Could not create cart' };
  }

  const addRes = await gqlRequest<{
    addDownloadableProductsToCart: {
      cart: { items: Array<{ product: { sku: string } }> } | null;
      user_errors: Array<{ message: string }>;
    };
  }>(
    `mutation AddDl($input: AddDownloadableProductsToCartInput!) {
      addDownloadableProductsToCart(input: $input) {
        cart { items { product { sku } } }
        user_errors { message }
      }
    }`,
    {
      input: {
        cart_id: cartId,
        cart_items: [
          {
            data: { sku: product.sku, quantity: 1 },
            downloadable_product_links: [{ link_id: product.linkId }],
          },
        ],
      },
    },
    token
  );

  const userErrors = addRes.data?.addDownloadableProductsToCart?.user_errors ?? [];
  if (userErrors.length > 0) {
    return { error: userErrors.map((e) => e.message).join('; ') };
  }
  if (addRes.errors?.length) {
    return { error: addRes.errors[0]!.message };
  }

  const billingRes = await gqlRequest(
    `mutation Billing($cartId: String!) {
      setBillingAddressOnCart(input: {
        cart_id: $cartId
        billing_address: {
          address: {
            firstname: "X"
            lastname: "Dispatch"
            street: ["1 rue de la Navigation"]
            city: "Paris"
            postcode: "75001"
            country_code: "FR"
            telephone: "0100000000"
          }
          same_as_shipping: true
        }
      }) { cart { id } }
    }`,
    { cartId },
    token
  );
  if (billingRes.errors?.length) {
    return { error: billingRes.errors[0]!.message };
  }

  const payRes = await gqlRequest(
    `mutation Pay($cartId: String!) {
      setPaymentMethodOnCart(input: {
        cart_id: $cartId
        payment_method: { code: "free" }
      }) { cart { selected_payment_method { code } } }
    }`,
    { cartId },
    token
  );
  if (payRes.errors?.length) {
    return { error: payRes.errors[0]!.message };
  }

  const orderRes = await gqlRequest<{
    placeOrder: { order: { order_number: string } | null } | null;
  }>(
    `mutation Place($cartId: String!) {
      placeOrder(input: { cart_id: $cartId }) {
        order { order_number }
      }
    }`,
    { cartId },
    token
  );

  const orderNumber = orderRes.data?.placeOrder?.order?.order_number;
  if (!orderNumber) {
    return { error: orderRes.errors?.[0]?.message ?? 'Order placement failed' };
  }

  const dlRes = await gqlRequest<{
    customerDownloadableProducts: {
      items: Array<{
        download_url: string;
        order_increment_id: string;
        remaining_downloads: number;
        status: string;
      }>;
    };
  }>(
    `query Downloads {
      customerDownloadableProducts {
        items {
          download_url
          order_increment_id
          remaining_downloads
          status
        }
      }
    }`,
    {},
    token
  );

  const items = dlRes.data?.customerDownloadableProducts?.items ?? [];
  const match =
    items.find((i) => i.order_increment_id === orderNumber && i.download_url) ??
    items.find((i) => i.download_url && i.remaining_downloads > 0);

  if (!match?.download_url) {
    return {
      error:
        'Commande validée mais lien de téléchargement introuvable — réessayez ou importez le ZIP manuellement.',
    };
  }

  return { downloadUrl: match.download_url };
}
