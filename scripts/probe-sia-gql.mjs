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
  return res.json();
}

const queries = [
  `query { products(filter: { name: { match: "eAIP" } }, pageSize: 8) {
    items { sku name __typename
      ... on DownloadableProduct { downloadable_product_links { id title price } }
    }
  }}`,
  `query { products(filter: { name: { match: "AMDT VAC" } }, pageSize: 8) {
    items { sku name __typename
      ... on DownloadableProduct { downloadable_product_links { id title price } }
    }
  }}`,
];

for (const q of queries) {
  const json = await gql(q);
  console.log(JSON.stringify(json.data ?? json.errors, null, 2));
  console.log('---');
}
