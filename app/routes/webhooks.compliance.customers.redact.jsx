/**
 * GDPR: customers/redact
 * Store owner requested deletion of customer data. We don't store per-customer data.
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customers-redact
 */

import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  await authenticate.webhook(request);
  // We only store shop-level and product-level aggregates (no customer id/email).
  // If we stored customer data we would delete/anonymize by customer id here.
  return new Response(null, { status: 200 });
};
