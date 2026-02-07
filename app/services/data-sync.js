/**
 * Data Sync Service
 * Synchronizes data from Shopify to local database
 */

import crypto from "node:crypto";
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
 * Sync all discount codes from Shopify (with pagination; creates and updates)
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

        const codes = codeDiscount.codes?.edges?.map((e) => e.node.code) || [];
        const discountCode = codes[0] || codeDiscount.title || "unknown";

        let discountType = "percentage";
        let discountValue = 0;

        const customerGetsValue = codeDiscount.customerGets?.value;
        if (customerGetsValue?.percentage != null) {
            discountType = "percentage";
            discountValue = Number(customerGetsValue.percentage);
        } else if (customerGetsValue?.amount?.amount != null) {
            discountType = "fixed_amount";
            discountValue = parseFloat(customerGetsValue.amount.amount);
        } else {
            discountType = "buy_x_get_y";
        }

        const startDate = codeDiscount.startsAt ? new Date(codeDiscount.startsAt) : new Date();
        const endDate = codeDiscount.endsAt ? new Date(codeDiscount.endsAt) : null;
        const totalOrdersFromApi = codeDiscount.asyncUsageCount ?? 0;

        const existingAnalysis = await prisma.discountAnalysis.findFirst({
            where: { shopId, discountCode }
        });

        if (existingAnalysis) {
            await prisma.discountAnalysis.update({
                where: { id: existingAnalysis.id },
                data: {
                    discountType,
                    discountValue,
                    startDate,
                    endDate,
                    totalOrders: totalOrdersFromApi
                }
            });
        } else {
            await prisma.discountAnalysis.create({
                data: {
                    shopId,
                    discountCode,
                    discountType,
                    discountValue,
                    startDate,
                    endDate,
                    totalOrders: totalOrdersFromApi
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

    // Aggregate per-product stats: with discount vs without (for ProductDiscountPerformance)
    const productStats = new Map(); // productId -> { unitsWith, revenueWith, profitWith, unitsWithout, revenueWithout, profitWithout }

    function addLineItemsToMap(order, useDiscountedPrice) {
        const lineEdges = order.lineItems?.edges || [];
        for (const edge of lineEdges) {
            const node = edge.node;
            const productId = node.product?.id;
            if (!productId) continue;

            const qty = node.quantity || 0;
            const costPerItem = node.variant?.inventoryItem?.unitCost?.amount
                ? parseFloat(node.variant.inventoryItem.unitCost.amount)
                : 0;
            const unitPrice = useDiscountedPrice
                ? parseFloat(node.discountedUnitPriceSet?.shopMoney?.amount || node.originalUnitPriceSet?.shopMoney?.amount || 0)
                : parseFloat(node.originalUnitPriceSet?.shopMoney?.amount || 0);

            const revenue = qty * unitPrice;
            const cost = qty * costPerItem;
            const profit = revenue - cost;

            if (!productStats.has(productId)) {
                productStats.set(productId, {
                    unitsSoldWithDiscount: 0,
                    revenueWithDiscount: 0,
                    profitWithDiscount: 0,
                    unitsSoldWithoutDiscount: 0,
                    revenueWithoutDiscount: 0,
                    profitWithoutDiscount: 0
                });
            }
            const s = productStats.get(productId);
            if (useDiscountedPrice) {
                s.unitsSoldWithDiscount += qty;
                s.revenueWithDiscount += revenue;
                s.profitWithDiscount += profit;
            } else {
                s.unitsSoldWithoutDiscount += qty;
                s.revenueWithoutDiscount += revenue;
                s.profitWithoutDiscount += profit;
            }
        }
    }

    for (const order of orders) {
        const hasDiscount = (order.discountApplications?.edges?.length || 0) > 0;
        addLineItemsToMap(order, hasDiscount);
    }

    // Update ProductDiscountPerformance for products we have in DB
    const shopProducts = await prisma.productDiscountPerformance.findMany({
        where: { shopId },
        select: { id: true, shopifyProductId: true }
    });

    for (const row of shopProducts) {
        const stats = productStats.get(row.shopifyProductId);
        if (!stats) continue;

        const margin = 0; // leave as-is, computed elsewhere
        const profitabilityScore = Math.min(100, Math.max(0, 50 + (stats.profitWithDiscount - stats.profitWithoutDiscount > 0 ? 10 : -10)));

        await prisma.productDiscountPerformance.update({
            where: { id: row.id },
            data: {
                unitsSoldWithDiscount: stats.unitsSoldWithDiscount,
                unitsSoldWithoutDiscount: stats.unitsSoldWithoutDiscount,
                revenueWithDiscount: stats.revenueWithDiscount,
                revenueWithoutDiscount: stats.revenueWithoutDiscount,
                profitWithDiscount: stats.profitWithDiscount,
                profitWithoutDiscount: stats.profitWithoutDiscount,
                profitabilityScore
            }
        });
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

    const perfIdMaxLen = 36;
    for (const product of products) {
        const variants = product.variants?.edges || [];
        const productTitle = product.title || "Produkt";
        const productCategory = product.productType || null;
        const productId = product.id;
        const id = crypto.createHash("sha256").update(shopId + productId).digest("hex").slice(0, perfIdMaxLen);

        for (const variantEdge of variants) {
            const variant = variantEdge.node;
            const regularPrice = parseFloat(variant.price) || 0;
            const cost = variant.inventoryItem?.unitCost?.amount
                ? parseFloat(variant.inventoryItem.unitCost.amount)
                : null;
            const margin =
                regularPrice > 0 && cost != null
                    ? Math.round(((regularPrice - cost) / regularPrice) * 1000) / 10
                    : null;

            await prisma.productDiscountPerformance.upsert({
                where: { id },
                update: {
                    regularPrice,
                    costPerItem: cost,
                    margin,
                    productTitle,
                    productCategory
                },
                create: {
                    id,
                    shopId,
                    shopifyProductId: productId,
                    productTitle,
                    productCategory,
                    regularPrice,
                    costPerItem: cost,
                    margin
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
        const productsProcessed = await syncProducts(admin, shop.id);
        const ordersProcessed = await syncOrders(admin, shop.id, 90);

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
        await updateSyncLog(syncLog.id, getFailedSyncLogUpdate(error));
        throw error;
    }
}

/**
 * Build update payload for sync log on failure (testable)
 */
export function getFailedSyncLogUpdate(error) {
    return {
        status: "failed",
        errorMessage: error?.message ?? String(error),
        completedAt: new Date()
    };
}
