/**
 * Webhook handler for products/update
 * Triggered when a product is updated (price, cost changes)
 */

import { authenticate } from "../../shopify.server";
import prisma from "../../db.server";

export const action = async ({ request }) => {
    const { topic, shop, payload } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    if (!payload) {
        return new Response("No payload", { status: 400 });
    }

    try {
        // Get shop record
        const shopRecord = await prisma.shop.findUnique({
            where: { shopDomain: shop }
        });

        if (!shopRecord) {
            return new Response("Shop not found", { status: 200 });
        }

        const productId = `gid://shopify/Product/${payload.id}`;
        const productTitle = payload.title;
        const productType = payload.product_type || null;

        // Get first variant price (simplified - in production, handle all variants)
        const variants = payload.variants || [];
        const firstVariant = variants[0];

        if (!firstVariant) {
            return new Response("No variants", { status: 200 });
        }

        const regularPrice = parseFloat(firstVariant.price || 0);

        // Update product performance record
        await prisma.productDiscountPerformance.upsert({
            where: {
                id: `${shopRecord.id}-${productId}`.slice(0, 36)
            },
            update: {
                productTitle,
                productCategory: productType,
                regularPrice
            },
            create: {
                id: `${shopRecord.id}-${productId}`.slice(0, 36),
                shopId: shopRecord.id,
                shopifyProductId: productId,
                productTitle,
                productCategory: productType,
                regularPrice
            }
        });

        console.log(`Updated product: ${productTitle}`);

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Error processing product update webhook:", error);
        return new Response("Error", { status: 500 });
    }
};
