/**
 * GDPR: customers/data_request
 * Customer requested their data. We don't store per-customer data (only shop/product aggregates).
 * Respond 200 to acknowledge; provide data to store owner if we had any.
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#customers-data_request
 */

import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  await authenticate.webhook(request);
  // We don't store customer-level data (no customer id/email in our DB).
  // If we did, we would compile and send data to the store owner here.
  return new Response(null, { status: 200 });
};
