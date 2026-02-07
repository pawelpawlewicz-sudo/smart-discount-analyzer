/**
 * Product Recommendations Page
 * Shows AI-generated discount recommendations for products
 */

import { useLoaderData, useFetcher } from "react-router";
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateRecommendation } from "../services/discount-analyzer";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    const shop = await prisma.shop.findUnique({
        where: { shopDomain }
    });

    if (!shop) {
        return { recommendations: [], products: [], shop: null };
    }

    // Get all recommendations
    const recommendations = await prisma.recommendation.findMany({
        where: { shopId: shop.id },
        orderBy: [
            { isActive: "desc" },
            { confidenceLevel: "desc" }
        ]
    });

    // Get product performances for products without recommendations
    const productPerformances = await prisma.productDiscountPerformance.findMany({
        where: { shopId: shop.id },
        orderBy: { profitabilityScore: "desc" },
        take: 20
    });

    return {
        shop,
        recommendations: recommendations.map(r => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            appliedAt: r.appliedAt?.toISOString() || null
        })),
        products: productPerformances.map(p => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        }))
    };
};

export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("action");

    const shop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop }
    });

    if (!shop) {
        return { success: false, error: "Shop not found" };
    }

    if (actionType === "generate") {
        // Generate recommendations for products
        const products = await prisma.productDiscountPerformance.findMany({
            where: { shopId: shop.id }
        });

        let generated = 0;

        for (const product of products) {
            // Calculate historical ROI for this product
            const margin = product.margin || shop.defaultMargin || 30;
            const historicalROI = product.profitabilityScore - 50; // Convert score to ROI-like value

            const rec = generateRecommendation({
                currentMargin: margin,
                historicalROI,
                priceElasticity: 1,
                lastDiscountLevel: product.recommendedDiscountLevel || 10
            });

            await prisma.recommendation.upsert({
                where: {
                    id: `${shop.id}-${product.shopifyProductId}`.slice(0, 36)
                },
                update: {
                    ...rec,
                    isActive: true,
                    productTitle: product.productTitle
                },
                create: {
                    id: `${shop.id}-${product.shopifyProductId}`.slice(0, 36),
                    shopId: shop.id,
                    shopifyProductId: product.shopifyProductId,
                    productTitle: product.productTitle,
                    ...rec
                }
            });

            generated++;
        }

        return { success: true, generated };
    }

    if (actionType === "dismiss") {
        const recommendationId = formData.get("recommendationId");
        await prisma.recommendation.update({
            where: { id: recommendationId },
            data: { isActive: false }
        });
        return { success: true };
    }

    return { success: false, error: "Unknown action" };
};

export default function Recommendations() {
    const { shop, recommendations, products } = useLoaderData();
    const fetcher = useFetcher();
    const shopify = useAppBridge();

    const isGenerating = fetcher.state === "submitting" && fetcher.formData?.get("action") === "generate";

    useEffect(() => {
        if (fetcher.data?.success && fetcher.data?.generated) {
            shopify.toast.show(`Wygenerowano ${fetcher.data.generated} rekomendacji!`);
        }
    }, [fetcher.data, shopify]);

    const handleGenerate = () => {
        fetcher.submit({ action: "generate" }, { method: "POST" });
    };

    const handleDismiss = (id) => {
        fetcher.submit({ action: "dismiss", recommendationId: id }, { method: "POST" });
    };

    const getRecommendationLabel = (type) => {
        switch (type) {
            case "increase": return { text: "Zwiększ rabat", tone: "success" };
            case "decrease": return { text: "Zmniejsz rabat", tone: "warning" };
            case "avoid": return { text: "Unikaj rabatów", tone: "critical" };
            case "maintain": return { text: "Utrzymaj", tone: "info" };
            default: return { text: type, tone: "info" };
        }
    };

    const activeRecs = recommendations.filter(r => r.isActive);
    const dismissedRecs = recommendations.filter(r => !r.isActive);

    return (
        <s-page
            heading="Rekomendacje produktowe"
            backAction={{ url: "/app" }}
        >
            <s-button
                slot="primary-action"
                onClick={handleGenerate}
                {...(isGenerating ? { loading: true } : {})}
            >
                Generuj rekomendacje
            </s-button>

            <s-section heading="Aktywne rekomendacje">
                {activeRecs.length > 0 ? (
                    <s-stack gap="base">
                        {activeRecs.map((rec) => {
                            const label = getRecommendationLabel(rec.recommendationType);
                            return (
                                <s-card key={rec.id}>
                                    <s-stack gap="base">
                                        <s-stack direction="inline" align="center" gap="base">
                                            <s-stack gap="none" style={{ flex: 1 }}>
                                                <s-text variant="headingMd">{rec.productTitle}</s-text>
                                                <s-badge tone={label.tone}>{label.text}</s-badge>
                                            </s-stack>
                                            <s-button variant="tertiary" onClick={() => handleDismiss(rec.id)}>
                                                Odrzuć
                                            </s-button>
                                        </s-stack>

                                        <s-grid columns="3" gap="tight">
                                            {rec.suggestedDiscountPercent !== null && (
                                                <s-stack gap="none">
                                                    <s-text variant="bodySm" tone="subdued">Sugerowany rabat</s-text>
                                                    <s-text variant="headingSm">{rec.suggestedDiscountPercent}%</s-text>
                                                </s-stack>
                                            )}
                                            {rec.expectedRoi !== null && (
                                                <s-stack gap="none">
                                                    <s-text variant="bodySm" tone="subdued">Oczekiwany ROI</s-text>
                                                    <s-text variant="headingSm" tone={rec.expectedRoi >= 0 ? "success" : "critical"}>
                                                        {rec.expectedRoi >= 0 ? '+' : ''}{rec.expectedRoi.toFixed(1)}%
                                                    </s-text>
                                                </s-stack>
                                            )}
                                            <s-stack gap="none">
                                                <s-text variant="bodySm" tone="subdued">Pewność</s-text>
                                                <s-text variant="headingSm">{Math.round(rec.confidenceLevel * 100)}%</s-text>
                                            </s-stack>
                                        </s-grid>

                                        {rec.reasoning && (
                                            <s-text variant="bodySm" tone="subdued">
                                                {rec.reasoning}
                                            </s-text>
                                        )}
                                    </s-stack>
                                </s-card>
                            );
                        })}
                    </s-stack>
                ) : (
                    <s-empty-state heading="Brak aktywnych rekomendacji">
                        <s-paragraph>
                            Kliknij "Generuj rekomendacje" aby otrzymać sugestie optymalizacji rabatów
                            na podstawie danych historycznych.
                        </s-paragraph>
                    </s-empty-state>
                )}
            </s-section>

            {/* Product Performance Overview */}
            <s-section slot="aside" heading="Wydajność produktów">
                {products.length > 0 ? (
                    <s-stack gap="tight">
                        {products.slice(0, 10).map((product) => (
                            <s-stack key={product.id} direction="inline" align="center" gap="tight">
                                <s-text variant="bodySm" style={{ flex: 1 }}>
                                    {product.productTitle.slice(0, 25)}...
                                </s-text>
                                <s-badge tone={
                                    product.profitabilityScore >= 70 ? "success" :
                                        product.profitabilityScore >= 40 ? "warning" : "critical"
                                }>
                                    {product.profitabilityScore}
                                </s-badge>
                            </s-stack>
                        ))}
                    </s-stack>
                ) : (
                    <s-paragraph tone="subdued">
                        Brak danych o produktach.
                    </s-paragraph>
                )}
            </s-section>

            {dismissedRecs.length > 0 && (
                <s-section slot="aside" heading="Odrzucone">
                    <s-text variant="bodySm" tone="subdued">
                        {dismissedRecs.length} odrzuconych rekomendacji
                    </s-text>
                </s-section>
            )}
        </s-page>
    );
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
