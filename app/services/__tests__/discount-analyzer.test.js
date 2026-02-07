/**
 * Unit tests for discount-analyzer service
 * Run: node --test app/services/__tests__/discount-analyzer.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import {
    calculateBreakevenMultiplier,
    calculateDiscountROI,
    analyzeDiscountPerformance,
    generateRecommendation,
    calculateOptimalDiscount
} from "../discount-analyzer.js";

describe("calculateBreakevenMultiplier", () => {
    it("returns multiplier > 1 when discount reduces margin", () => {
        const mult = calculateBreakevenMultiplier(100, 50, 10);
        assert.ok(mult > 1);
        assert.strictEqual(mult, 1.25); // 50/40
    });

    it("returns Infinity when discounted margin is zero or negative", () => {
        assert.strictEqual(calculateBreakevenMultiplier(100, 90, 10), Infinity);
        assert.strictEqual(calculateBreakevenMultiplier(100, 95, 10), Infinity);
    });
});

describe("calculateDiscountROI", () => {
    it("returns positive ROI when additional profit exceeds lost margin (exact values)", () => {
        const result = calculateDiscountROI({
            salesWithDiscount: 20,
            salesWithoutDiscount: 10,
            regularPrice: 100,
            discountedPrice: 90,
            cost: 50
        });
        assert.strictEqual(result.isProfitable, true);
        assert.strictEqual(result.additionalProfit, 300); // 800 - 500
        assert.strictEqual(result.roi, 150); // 300/200 * 100
        assert.strictEqual(result.profitabilityScore, 100);
    });

    it("returns negative ROI when discount reduces profit (exact)", () => {
        const result = calculateDiscountROI({
            salesWithDiscount: 10,
            salesWithoutDiscount: 10,
            regularPrice: 100,
            discountedPrice: 80,
            cost: 50
        });
        assert.strictEqual(result.isProfitable, false);
        assert.strictEqual(result.additionalProfit, -200); // 300 - 500
        assert.ok(result.profitabilityScore <= 50);
    });
});

describe("analyzeDiscountPerformance", () => {
    it("aggregates orders and computes ROI", () => {
        const result = analyzeDiscountPerformance({
            ordersWithDiscount: [
                {
                    totalPrice: 200,
                    totalDiscount: 20,
                    lineItems: [{ quantity: 2, costPerItem: 50 }]
                }
            ],
            comparisonOrders: [
                { totalPrice: 100, lineItems: [{ quantity: 1, costPerItem: 50 }] }
            ],
            discountValue: 10,
            discountType: "percentage"
        });
        assert.strictEqual(result.totalOrders, 1);
        assert.strictEqual(result.totalRevenue, 200);
        assert.strictEqual(result.totalCost, 100);
        assert.strictEqual(result.totalProfit, 100);
        assert.strictEqual(result.totalDiscount, 20);
        assert.ok(typeof result.roiPercentage === "number");
        assert.ok(typeof result.isProfitable === "boolean");
        assert.ok(result.profitabilityScore >= 0 && result.profitabilityScore <= 100);
    });

    it("handles empty ordersWithDiscount", () => {
        const result = analyzeDiscountPerformance({
            ordersWithDiscount: [],
            comparisonOrders: [{ totalPrice: 100, lineItems: [] }],
            discountValue: 10,
            discountType: "percentage"
        });
        assert.strictEqual(result.totalOrders, 0);
        assert.strictEqual(result.totalRevenue, 0);
        assert.strictEqual(result.totalProfit, 0);
        assert.strictEqual(result.totalDiscount, 0);
        assert.strictEqual(result.avgOrderValue, 0);
    });

    it("handles zero totalDiscount (ROI edge case)", () => {
        const result = analyzeDiscountPerformance({
            ordersWithDiscount: [
                { totalPrice: 100, totalDiscount: 0, lineItems: [{ quantity: 1, costPerItem: 50 }] }
            ],
            comparisonOrders: [],
            discountValue: 0,
            discountType: "percentage"
        });
        assert.strictEqual(result.totalDiscount, 0);
        assert.ok(typeof result.roiPercentage === "number");
        assert.ok(result.profitabilityScore >= 0 && result.profitabilityScore <= 100);
    });
});

describe("generateRecommendation", () => {
    it("returns avoid when historicalROI is very negative (exact output)", () => {
        const r = generateRecommendation({
            currentMargin: 30,
            historicalROI: -25,
            priceElasticity: 1,
            lastDiscountLevel: 15
        });
        assert.strictEqual(r.recommendationType, "avoid");
        assert.strictEqual(r.suggestedDiscountPercent, 0);
        assert.strictEqual(r.confidenceLevel, 0.8);
        assert.strictEqual(r.reasoningKey, "avoid");
        assert.ok(r.reasoning.includes("unikanie") || r.reasoning.includes("straty"));
    });

    it("returns decrease when historicalROI negative but >= -20 (exact suggested %)", () => {
        const r = generateRecommendation({
            currentMargin: 30,
            historicalROI: -10,
            priceElasticity: 1,
            lastDiscountLevel: 15
        });
        assert.strictEqual(r.recommendationType, "decrease");
        assert.strictEqual(r.suggestedDiscountPercent, 10); // lastDiscountLevel - 5
    });

    it("returns maintain for moderate positive ROI (exact output)", () => {
        const r = generateRecommendation({
            currentMargin: 30,
            historicalROI: 20,
            priceElasticity: 1,
            lastDiscountLevel: 10
        });
        assert.strictEqual(r.recommendationType, "maintain");
        assert.strictEqual(r.suggestedDiscountPercent, 10);
    });

    it("returns increase when historicalROI > 50 and elasticity > 1.5 (capped by 50% margin)", () => {
        const r = generateRecommendation({
            currentMargin: 40,
            historicalROI: 60,
            priceElasticity: 2,
            lastDiscountLevel: 10
        });
        assert.strictEqual(r.recommendationType, "increase");
        assert.strictEqual(r.suggestedDiscountPercent, 15); // min(10+5, 40*0.5) = 15
    });

    it("increase does not exceed 50% of margin", () => {
        const r = generateRecommendation({
            currentMargin: 20,
            historicalROI: 60,
            priceElasticity: 2,
            lastDiscountLevel: 15
        });
        assert.strictEqual(r.recommendationType, "increase");
        assert.strictEqual(r.suggestedDiscountPercent, 10); // min(20, 20*0.5) = 10
    });
});

describe("calculateOptimalDiscount", () => {
    it("returns value within margin and target", () => {
        const d = calculateOptimalDiscount(30, 1, 20);
        assert.ok(d >= 0);
        assert.ok(d <= 15); // max 50% of margin
    });

    it("returns 0 or positive for zero margin", () => {
        const d = calculateOptimalDiscount(0, 1, 20);
        assert.ok(d >= 0);
    });
});
