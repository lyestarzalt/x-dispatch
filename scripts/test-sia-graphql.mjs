const GQL = 'https://www.sia.aviation-civile.gouv.fr/graphql';

async function gql(query, variables = {}, token) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error('GQL errors:', JSON.stringify(json.errors, null, 2));
    return { data: json.data, errors: json.errors };
  }
  return { data: json.data, errors: null };
}

function linkOptionId(linkId) {
  return Buffer.from(`downloadable/${linkId}`).toString('base64');
}

async function main() {
  const email = `x-dispatch-test-${Date.now()}@example.com`;
  const password = 'XDispatch-Test-2026!';

  console.log('1. createCustomer', email);
  const create = await gql(`
    mutation($input: CustomerCreateInput!) {
      createCustomerV2(input: $input) {
        customer { email }
      }
    }
  `, {
    input: {
      email,
      firstname: 'X',
      lastname: 'Dispatch',
      password,
      is_subscribed: false,
    },
  });
  console.log('create', create.data?.createCustomerV2 ?? create.errors?.[0]?.message);

  console.log('2. login');
  const login = await gql(`
    mutation($email: String!, $password: String!) {
      generateCustomerToken(email: $email, password: $password) {
        token
      }
    }
  `, { email, password });
  const token = login.data?.generateCustomerToken?.token;
  if (!token) return;

  console.log('3. createCustomerCart');
  const cartRes = await gql(`mutation { createEmptyCart }`, {}, token);
  const cartId = cartRes.data?.createEmptyCart;
  console.log('cartId', cartId);

  const linkId = 2015; // AMDT VAC H
  const sku = 'AMDT VAC H NON AIRAC 06/26';
  const selectedOptions = [linkOptionId(linkId)];

  console.log('4. addProductsToCart', selectedOptions);
  const add = await gql(`
    mutation($cartId: String!, $sku: String!, $opts: [String!]!) {
      addProductsToCart(
        cartId: $cartId
        cartItems: [{ sku: $sku, quantity: 1, selected_options: $opts }]
      ) {
        cart { items { product { sku } } }
        user_errors { message }
      }
    }
  `, { cartId, sku, opts: selectedOptions }, token);
  console.log('add', JSON.stringify(add.data?.addProductsToCart, null, 2));

  await gql(`
    mutation($cartId: String!, $email: String!) {
      setBillingAddressOnCart(input: {
        cart_id: $cartId
        billing_address: {
          address: {
            firstname: "X"
            lastname: "Dispatch"
            street: ["1 rue Test"]
            city: "Paris"
            postcode: "75001"
            country_code: "FR"
            telephone: "0100000000"
          }
        }
      }) { cart { billing_address { firstname } } }
    }
  `, { cartId, email }, token);

  await gql(`
    mutation($cartId: String!) {
      setPaymentMethodOnCart(input: {
        cart_id: $cartId
        payment_method: { code: "free" }
      }) { cart { selected_payment_method { code } } }
    }
  `, { cartId }, token);

  const order = await gql(`
    mutation($cartId: String!) {
      placeOrder(input: { cart_id: $cartId }) {
        order { order_number }
      }
    }
  `, { cartId }, token);
  console.log('order', order.data?.placeOrder);

  console.log('5. customer downloadable products');
  const dl = await gql(`
    query {
      customerDownloadableProducts {
        items {
          title
          date
          status
          order_increment_id
          download_url
        }
      }
    }
  `, {}, token);
  console.log('downloads', JSON.stringify(dl.data?.customerDownloadableProducts?.items, null, 2));
}

main().catch(console.error);
