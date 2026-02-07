/**
 * Shopify GraphQL Queries and Mutations
 * For fetching orders, products, and discounts data
 */

// Query to fetch orders with discount information
export const GET_ORDERS_WITH_DISCOUNTS = `#graphql
  query GetOrdersWithDiscounts($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        cursor
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountApplications(first: 10) {
            edges {
              node {
                allocationMethod
                targetSelection
                targetType
                value {
                  ... on MoneyV2 {
                    amount
                    currencyCode
                  }
                  ... on PricingPercentageValue {
                    percentage
                  }
                }
                ... on DiscountCodeApplication {
                  code
                }
                ... on ManualDiscountApplication {
                  title
                }
              }
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                product {
                  id
                  title
                }
                variant {
                  id
                  price
                  inventoryItem {
                    unitCost {
                      amount
                    }
                  }
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Query to fetch all discount codes
export const GET_DISCOUNT_CODES = `#graphql
  query GetDiscountCodes($first: Int!, $after: String) {
    codeDiscountNodes(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 10) {
                edges {
                  node {
                    code
                  }
                }
              }
              startsAt
              endsAt
              usageLimit
              customerGets {
                value {
                  ... on DiscountPercentage {
                    percentage
                  }
                  ... on DiscountAmount {
                    amount {
                      amount
                    }
                  }
                }
              }
              summary
              status
              asyncUsageCount
            }
            ... on DiscountCodeBxgy {
              title
              codes(first: 10) {
                edges {
                  node {
                    code
                  }
                }
              }
              startsAt
              endsAt
              status
              asyncUsageCount
            }
            ... on DiscountCodeFreeShipping {
              title
              codes(first: 10) {
                edges {
                  node {
                    code
                  }
                }
              }
              startsAt
              endsAt
              status
              asyncUsageCount
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Query to fetch products with cost information
export const GET_PRODUCTS_WITH_COST = `#graphql
  query GetProductsWithCost($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          productType
          status
          totalInventory
          priceRangeV2 {
            minVariantPrice {
              amount
            }
            maxVariantPrice {
              amount
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
                inventoryItem {
                  unitCost {
                    amount
                  }
                }
                inventoryQuantity
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Mutation: create basic percentage discount code (for "Zastosuj rekomendację")
export const CREATE_DISCOUNT_CODE_BASIC = `#graphql
  mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title
            codes(first: 5) { nodes { code } }
          }
        }
      }
      userErrors { field message }
    }
  }
`;

// Query to get shop info
export const GET_SHOP_INFO = `#graphql
  query GetShopInfo {
    shop {
      id
      name
      currencyCode
      primaryDomain {
        url
        host
      }
      plan {
        displayName
      }
    }
  }
`;

// Query to get orders count for a specific discount code
export const GET_ORDERS_BY_DISCOUNT_CODE = `#graphql
  query GetOrdersByDiscountCode($first: Int!, $after: String, $discountCode: String!) {
    orders(first: $first, after: $after, query: $discountCode) {
      edges {
        cursor
        node {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
            }
          }
          discountCode
          lineItems(first: 20) {
            edges {
              node {
                title
                quantity
                product {
                  id
                }
                variant {
                  price
                  inventoryItem {
                    unitCost {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 5;

/**
 * Call admin.graphql with retry on rate limit (429) and server errors (5xx)
 */
async function graphqlWithRetry(admin, query, variables) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const response = await admin.graphql(query, { variables });
        const status = response.status;

        if (status === 429) {
            const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            continue;
        }
        if (status >= 500 && status < 600) {
            const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            continue;
        }

        const data = await response.json();
        if (data.errors && data.errors.length > 0) {
            lastError = new Error(data.errors.map((e) => e.message).join("; "));
            if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, DEFAULT_RETRY_DELAY_MS * attempt));
                continue;
            }
            throw lastError;
        }
        return data;
    }
    throw lastError || new Error("GraphQL request failed after retries");
}

/**
 * Helper to paginate through all results (with retry/backoff for rate limits)
 */
export async function fetchAllPages(admin, query, variables, extractEdges) {
    const allResults = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
        const data = await graphqlWithRetry(admin, query, {
            ...variables,
            after: cursor
        });

        const result = extractEdges(data.data);
        const edges = result?.edges ?? [];
        const pageInfo = result?.pageInfo ?? { hasNextPage: false, endCursor: null };

        allResults.push(...edges.map((edge) => edge.node));

        hasNextPage = pageInfo.hasNextPage === true;
        cursor = pageInfo.endCursor ?? null;

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return allResults;
}
