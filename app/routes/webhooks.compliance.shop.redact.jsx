/**
 * GDPR: shop/redact
 * Sent 48h after app uninstall. Delete all data for this shop.
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#shop-redact
 */

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const { payload } = await authenticate.webhook(request);
  if (!payload?.shop_domain) {
    return new Response(null, { status: 200 });
  }
  const shopDomain = payload.shop_domain;
  try {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain }
    });
    if (shop) {
      await prisma.shop.delete({
        where: { id: shop.id }
      });
    }
    return new Response(null, { status: 200 });
  } catch (e) {
    console.error("shop/redact error:", e);
    return new Response(null, { status: 200 });
  }
};
