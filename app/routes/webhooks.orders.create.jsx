/**
 * Webhook handler for orders/create
 * Triggered when a new order is created in Shopify
 */

import { authenticate } from "../../shopify.server";
import prisma from "../../db.server";
import { analyzeDiscountPerformance } from "../../services/discount-analyzer";

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
            console.log(`Shop ${shop} not found in database`);
            return new Response("Shop not found", { status: 200 });
        }

        // Check if order has discount codes
        const discountCodes = payload.discount_codes || [];

        if (discountCodes.length === 0) {
            // No discounts, nothing to analyze
            return new Response("OK", { status: 200 });
        }

        // Process each discount code used in the order
        for (const discountCode of discountCodes) {
            const code = discountCode.code;
            const discountAmount = parseFloat(discountCode.amount || 0);

            // Find or create discount analysis
            let analysis = await prisma.discountAnalysis.findFirst({
                where: {
                    shopId: shopRecord.id,
                    discountCode: code
                }
            });

            if (!analysis) {
                // Create new analysis for this discount code
                analysis = await prisma.discountAnalysis.create({
                    data: {
                        shopId: shopRecord.id,
                        discountCode: code,
                        discountType: discountCode.type || "percentage",
                        discountValue: 0, // Will be updated during sync
                        startDate: new Date(),
                        totalOrders: 0,
                        totalRevenue: 0,
                        totalCost: 0,
                        totalProfit: 0,
                        totalDiscount: 0
                    }
                });
            }

            // Calculate order metrics
            const orderTotal = parseFloat(payload.total_price || 0);
            let orderCost = 0;

            for (const lineItem of (payload.line_items || [])) {
                // Note: Line items don't include cost in webhook, we'll use stored data
                const productPerf = await prisma.productDiscountPerformance.findFirst({
                    where: {
                        shopId: shopRecord.id,
                        shopifyProductId: `gid://shopify/Product/${lineItem.product_id}`
                    }
                });

                if (productPerf?.costPerItem) {
                    orderCost += productPerf.costPerItem * lineItem.quantity;
                }
            }

            const orderProfit = orderTotal - orderCost;

            // Update discount analysis with new order data
            await prisma.discountAnalysis.update({
                where: { id: analysis.id },
                data: {
                    totalOrders: { increment: 1 },
                    totalRevenue: { increment: orderTotal },
                    totalCost: { increment: orderCost },
                    totalProfit: { increment: orderProfit },
                    totalDiscount: { increment: discountAmount },
                    avgOrderValue: (analysis.totalRevenue + orderTotal) / (analysis.totalOrders + 1)
                }
            });

            console.log(`Updated discount analysis for code: ${code}`);
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Error processing order webhook:", error);
        return new Response("Error", { status: 500 });
    }
};
