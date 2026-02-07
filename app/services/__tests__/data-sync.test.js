/**
 * Integration-style tests for data-sync (with mocks).
 * Tests aggregation logic used in syncOrders without real DB/Shopify.
 * Run: node --test app/services/__tests__/data-sync.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert";

// Inline aggregation logic mirroring syncOrders productStats (no DB)
function aggregateProductStatsFromOrders(orders) {
    const productStats = new Map();

    function addLineItems(order, useDiscountedPrice) {
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
        addLineItems(order, hasDiscount);
    }

    return productStats;
}

describe("data-sync aggregation (product stats from orders)", () => {
    it("splits product stats by with/without discount", () => {
        const orders = [
            {
                discountApplications: { edges: [{ node: {} }] },
                lineItems: {
                    edges: [
                        {
                            node: {
                                product: { id: "gid://shopify/Product/1" },
                                quantity: 2,
                                originalUnitPriceSet: { shopMoney: { amount: "100" } },
                                discountedUnitPriceSet: { shopMoney: { amount: "90" } },
                                variant: { inventoryItem: { unitCost: { amount: "50" } } }
                            }
                        }
                    ]
                }
            },
            {
                discountApplications: { edges: [] },
                lineItems: {
                    edges: [
                        {
                            node: {
                                product: { id: "gid://shopify/Product/1" },
                                quantity: 1,
                                originalUnitPriceSet: { shopMoney: { amount: "100" } },
                                variant: { inventoryItem: { unitCost: { amount: "50" } } }
                            }
                        }
                    ]
                }
            }
        ];

        const stats = aggregateProductStatsFromOrders(orders);
        const p1 = stats.get("gid://shopify/Product/1");
        assert.ok(p1);
        assert.strictEqual(p1.unitsSoldWithDiscount, 2);
        assert.strictEqual(p1.revenueWithDiscount, 180);
        assert.strictEqual(p1.unitsSoldWithoutDiscount, 1);
        assert.strictEqual(p1.revenueWithoutDiscount, 100);
    });

    it("ignores line items without product id", () => {
        const orders = [
            {
                discountApplications: { edges: [{ node: {} }] },
                lineItems: {
                    edges: [
                        { node: { product: null, quantity: 5 } },
                        { node: { product: { id: "p1" }, quantity: 1, originalUnitPriceSet: { shopMoney: { amount: "10" } }, discountedUnitPriceSet: { shopMoney: { amount: "10" } }, variant: {} } }
                    ]
                }
            }
        ];
        const stats = aggregateProductStatsFromOrders(orders);
        assert.strictEqual(stats.size, 1);
        assert.strictEqual(stats.get("p1").unitsSoldWithDiscount, 1);
    });
});

describe("getFailedSyncLogUpdate", () => {
    it("returns status failed and error message", async () => {
        const { getFailedSyncLogUpdate } = await import("../data-sync.js");
        const err = new Error("GraphQL rate limit");
        const update = getFailedSyncLogUpdate(err);
        assert.strictEqual(update.status, "failed");
        assert.strictEqual(update.errorMessage, "GraphQL rate limit");
        assert.ok(update.completedAt instanceof Date);
    });

    it("handles non-Error throwables", async () => {
        const { getFailedSyncLogUpdate } = await import("../data-sync.js");
        const update = getFailedSyncLogUpdate("string error");
        assert.strictEqual(update.status, "failed");
        assert.strictEqual(update.errorMessage, "string error");
    });
});
