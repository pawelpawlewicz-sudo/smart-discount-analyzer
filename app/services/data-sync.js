/**
 * Data Sync Service
 * Synchronizes data from Shopify to local database
 */

import prisma from "../db.server.js";
import {
    GET_ORDERS_WITH_DISCOUNTS,
    GET_DISCOUNT_CODES,
    GET_PRODUCTS_WITH_COST,
    fetchAllPages
} from "./shopify-queries.js";
import { analyzeDiscountPerformance } from "./discount-analyzer.js";

/**
 * Initialize or get shop record
 */
export async function getOrCreateShop(shopDomain) {
    let shop = await prisma.shop.findUnique({
        where: { shopDomain }
    });

    if (!shop) {
        shop = await prisma.shop.create({
            data: {
                shopDomain,
                defaultMargin: 30,
                currency: "PLN"
            }
        });
    }

    return shop;
}

/**
 * Create a sync log entry
 */
export async function createSyncLog(shopId, syncType) {
    return prisma.syncLog.create({
        data: {
            shopId,
            syncType,
            status: "in_progress"
        }
    });
}

/**
 * Update sync log status
 */
export async function updateSyncLog(syncLogId, updates) {
    return prisma.syncLog.update({
        where: { id: syncLogId },
        data: updates
    });
}

/**
 * Sync all discount codes from Shopify
 */
export async function syncDiscountCodes(admin, shopId) {
    const discounts = await fetchAllPages(
        admin,
        GET_DISCOUNT_CODES,
        { first: 50 },
        (data) => data.codeDiscountNodes
    );

    let processedCount = 0;

    for (const discount of discounts) {
        const codeDiscount = discount.codeDiscount;
        if (!codeDiscount) continue;

        // Extract discount code and value
        const codes = codeDiscount.codes?.edges?.map(e => e.node.code) || [];
        const discountCode = codes[0] || codeDiscount.title;

        // Determine discount type and value
        let discountType = "percentage";
        let discountValue = 0;

        const customerGetsValue = codeDiscount.customerGets?.value;
        if (customerGetsValue?.percentage) {
            discountType = "percentage";
            discountValue = customerGetsValue.percentage;
        } else if (customerGetsValue?.amount?.amount) {
            discountType = "fixed_amount";
            discountValue = parseFloat(customerGetsValue.amount.amount);
        }

        // Check if analysis already exists
        const existingAnalysis = await prisma.discountAnalysis.findFirst({
            where: {
                shopId,
                discountCode
            }
        });

        if (!existingAnalysis) {
            await prisma.discountAnalysis.create({
                data: {
                    shopId,
                    discountCode,
                    discountType,
                    discountValue,
                    startDate: codeDiscount.startsAt ? new Date(codeDiscount.startsAt) : new Date(),
                    endDate: codeDiscount.endsAt ? new Date(codeDiscount.endsAt) : null,
                    totalOrders: codeDiscount.asyncUsageCount || 0
                }
            });
        }

        processedCount++;
    }

    return processedCount;
}

/**
 * Sync orders and update discount analyses
 */
export async function syncOrders(admin, shopId, daysBack = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const orders = await fetchAllPages(
        admin,
        GET_ORDERS_WITH_DISCOUNTS,
        {
            first: 50,
            query: `created_at:>=${startDate.toISOString()}`
        },
        (data) => data.orders
    );

    // Group orders by discount code
    const ordersByDiscount = new Map();
    const ordersWithoutDiscount = [];

    for (const order of orders) {
        const discountApps = order.discountApplications?.edges || [];

        if (discountApps.length > 0) {
            for (const discountApp of discountApps) {
                const code = discountApp.node.code || discountApp.node.title || "manual";

                if (!ordersByDiscount.has(code)) {
                    ordersByDiscount.set(code, []);
                }

                ordersByDiscount.get(code).push({
                    ...order,
                    totalPrice: order.totalPriceSet?.shopMoney?.amount || 0,
                    totalDiscount: order.totalDiscountsSet?.shopMoney?.amount || 0,
                    lineItems: order.lineItems?.edges?.map(e => ({
                        ...e.node,
                        costPerItem: e.node.variant?.inventoryItem?.unitCost?.amount
                            ? parseFloat(e.node.variant.inventoryItem.unitCost.amount)
                            : 0
                    })) || []
                });
            }
        } else {
            ordersWithoutDiscount.push({
                ...order,
                totalPrice: order.totalPriceSet?.shopMoney?.amount || 0,
                lineItems: order.lineItems?.edges?.map(e => ({
                    ...e.node,
                    costPerItem: e.node.variant?.inventoryItem?.unitCost?.amount
                        ? parseFloat(e.node.variant.inventoryItem.unitCost.amount)
                        : 0
                })) || []
            });
        }
    }

    // Update discount analyses
    for (const [discountCode, discountOrders] of ordersByDiscount) {
        const analysis = await prisma.discountAnalysis.findFirst({
            where: { shopId, discountCode }
        });

        if (analysis) {
            // Get discount value for calculation
            const result = analyzeDiscountPerformance({
                ordersWithDiscount: discountOrders,
                comparisonOrders: ordersWithoutDiscount.slice(0, discountOrders.length * 2), // Use 2x orders as baseline
                discountValue: analysis.discountValue,
                discountType: analysis.discountType
            });

            await prisma.discountAnalysis.update({
                where: { id: analysis.id },
                data: {
                    totalOrders: result.totalOrders,
                    totalRevenue: result.totalRevenue,
                    totalCost: result.totalCost,
                    totalProfit: result.totalProfit,
                    totalDiscount: result.totalDiscount,
                    avgOrderValue: result.avgOrderValue,
                    roiPercentage: result.roiPercentage,
                    isProfitable: result.isProfitable,
                    profitabilityScore: result.profitabilityScore
                }
            });
        }
    }

    return orders.length;
}

/**
 * Sync product cost data
 */
export async function syncProducts(admin, shopId) {
    const products = await fetchAllPages(
        admin,
        GET_PRODUCTS_WITH_COST,
        { first: 50 },
        (data) => data.products
    );

    // Store product data for future reference
    for (const product of products) {
        const variants = product.variants?.edges || [];

        for (const variantEdge of variants) {
            const variant = variantEdge.node;
            const cost = variant.inventoryItem?.unitCost?.amount
                ? parseFloat(variant.inventoryItem.unitCost.amount)
                : null;

            // Update or create product performance record
            await prisma.productDiscountPerformance.upsert({
                where: {
                    id: `${shopId}-${product.id}`.slice(0, 36) // Generate consistent ID
                },
                update: {
                    regularPrice: parseFloat(variant.price),
                    costPerItem: cost,
                    productTitle: product.title,
                    productCategory: product.productType || null
                },
                create: {
                    id: `${shopId}-${product.id}`.slice(0, 36),
                    shopId,
                    shopifyProductId: product.id,
                    productTitle: product.title,
                    productCategory: product.productType || null,
                    regularPrice: parseFloat(variant.price),
                    costPerItem: cost
                }
            });
        }
    }

    return products.length;
}

/**
 * Full sync - syncs all data
 */
export async function performFullSync(admin, shopDomain) {
    const shop = await getOrCreateShop(shopDomain);
    const syncLog = await createSyncLog(shop.id, "full");

    try {
        const discountsProcessed = await syncDiscountCodes(admin, shop.id);
        const ordersProcessed = await syncOrders(admin, shop.id, 90);
        const productsProcessed = await syncProducts(admin, shop.id);

        await updateSyncLog(syncLog.id, {
            status: "completed",
            discountsProcessed,
            ordersProcessed,
            productsProcessed,
            completedAt: new Date()
        });

        await prisma.shop.update({
            where: { id: shop.id },
            data: { lastSyncAt: new Date() }
        });

        return {
            success: true,
            discountsProcessed,
            ordersProcessed,
            productsProcessed
        };
    } catch (error) {
        await updateSyncLog(syncLog.id, {
            status: "failed",
            errorMessage: error.message,
            completedAt: new Date()
        });

        throw error;
    }
}
