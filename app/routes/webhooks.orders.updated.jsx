/**
 * Webhook handler for orders/updated
 * Triggered when an order is updated (refunds, cancellations, etc.)
 */

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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

        // Check for refunds/cancellations
        const financialStatus = payload.financial_status;
        const cancelledAt = payload.cancelled_at;

        if (financialStatus === "refunded" || cancelledAt) {
            // Order was refunded or cancelled - adjust discount analysis
            const discountCodes = payload.discount_codes || [];

            for (const discountCode of discountCodes) {
                const code = discountCode.code;
                const discountAmount = parseFloat(discountCode.amount || 0);
                const orderTotal = parseFloat(payload.total_price || 0);

                const analysis = await prisma.discountAnalysis.findFirst({
                    where: {
                        shopId: shopRecord.id,
                        discountCode: code
                    }
                });

                if (analysis && analysis.totalOrders > 0) {
                    // Subtract the refunded order from totals
                    await prisma.discountAnalysis.update({
                        where: { id: analysis.id },
                        data: {
                            totalOrders: { decrement: 1 },
                            totalRevenue: { decrement: orderTotal },
                            totalDiscount: { decrement: discountAmount }
                        }
                    });

                    console.log(`Adjusted discount analysis for refunded order, code: ${code}`);
                }
            }
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Error processing order update webhook:", error);
        return new Response("Error", { status: 500 });
    }
};
