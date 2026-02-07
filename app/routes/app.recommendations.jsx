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
import { CREATE_DISCOUNT_CODE_BASIC } from "../services/shopify-queries";
import { getT, translations, getTForLocale } from "../i18n/translations";

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

    const locale = shop?.locale ?? "en";
    return {
        shop,
        locale,
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
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("action");

    const shop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop }
    });

    if (!shop) {
        return { success: false, error: "Shop not found" };
    }
    const locale = shop.locale ?? "en";
    const t = (key, params) => getT(translations)(locale, key, params);

    if (actionType === "apply") {
        const recommendationId = formData.get("recommendationId");
        const rec = await prisma.recommendation.findFirst({
            where: { id: recommendationId, shopId: shop.id }
        });
        if (!rec || rec.recommendationType === "avoid" || rec.isApplied) {
            return { success: false, error: t("error.recommendationCannotApply") };
        }
        const percent = rec.suggestedDiscountPercent ?? 10;
        const code = `REC-${rec.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//, "").slice(0, 8).toUpperCase()}-${Math.round(percent)}`;
        const startsAt = new Date().toISOString();
        const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const response = await admin.graphql(CREATE_DISCOUNT_CODE_BASIC, {
            variables: {
                basicCodeDiscount: {
                    title: `Rekomendacja: ${rec.productTitle} (${percent}%)`,
                    code,
                    startsAt,
                    endsAt,
                    customerSelection: { all: true },
                    customerGets: {
                        value: { percentage: percent / 100 },
                        items: { all: true }
                    },
                    appliesOncePerCustomer: false
                }
            }
        });

        const json = await response.json();
        const payload = json.data?.discountCodeBasicCreate;
        const userErrors = payload?.userErrors || [];
        if (userErrors.length > 0) {
            return { success: false, error: userErrors.map((e) => e.message).join("; ") };
        }
        if (!payload?.codeDiscountNode) {
            return { success: false, error: t("error.discountCreateFailed") };
        }

        await prisma.recommendation.update({
            where: { id: recommendationId },
            data: { isApplied: true, appliedAt: new Date() }
        });

        return { success: true, code, message: t("success.discountCreated", { code }) };
    }

    if (actionType === "generate") {
        const products = await prisma.productDiscountPerformance.findMany({
            where: { shopId: shop.id }
        });

        let generated = 0;

        for (const product of products) {
            const margin = product.margin ?? shop.defaultMargin ?? 30;
            const historicalROI = product.profitabilityScore - 50;

            const rec = generateRecommendation({
                currentMargin: margin,
                historicalROI,
                priceElasticity: 1,
                lastDiscountLevel: product.recommendedDiscountLevel ?? 10
            });

            const existing = await prisma.recommendation.findFirst({
                where: {
                    shopId: shop.id,
                    shopifyProductId: product.shopifyProductId
                }
            });

            const payload = {
                recommendationType: rec.recommendationType,
                suggestedDiscountPercent: rec.suggestedDiscountPercent,
                expectedRoi: rec.expectedRoi,
                confidenceLevel: rec.confidenceLevel,
                reasoning: rec.reasoning,
                reasoningKey: rec.reasoningKey ?? rec.recommendationType,
                isActive: true,
                productTitle: product.productTitle
            };

            if (existing) {
                await prisma.recommendation.update({
                    where: { id: existing.id },
                    data: payload
                });
            } else {
                await prisma.recommendation.create({
                    data: {
                        shopId: shop.id,
                        shopifyProductId: product.shopifyProductId,
                        productTitle: product.productTitle,
                        ...rec
                    }
                });
            }

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
    const { shop, recommendations, products, locale } = useLoaderData();
    const t = getTForLocale(locale ?? "en");
    const fetcher = useFetcher();
    const shopify = useAppBridge();

    const isGenerating = fetcher.state === "submitting" && fetcher.formData?.get("action") === "generate";

    useEffect(() => {
        if (fetcher.data?.success && fetcher.data?.generated) {
            shopify.toast.show(t("success.generatedCount", { count: fetcher.data.generated }));
        }
        if (fetcher.data?.success && fetcher.data?.code) {
            shopify.toast.show(fetcher.data.message || `Utworzono kod: ${fetcher.data.code}`);
        }
        if (fetcher.data?.success === false && fetcher.data?.error) {
            shopify.toast.show(`${t("error.generic")}: ${fetcher.data.error}`, { isError: true });
        }
    }, [fetcher.data, shopify]);

    const handleGenerate = () => {
        fetcher.submit({ action: "generate" }, { method: "POST" });
    };

    const handleDismiss = (id) => {
        fetcher.submit({ action: "dismiss", recommendationId: id }, { method: "POST" });
    };

    const handleApply = (id) => {
        fetcher.submit({ action: "apply", recommendationId: id }, { method: "POST" });
    };

    const getRecommendationLabel = (type) => {
        const key = "recType." + type;
        const text = t(key);
        switch (type) {
            case "increase": return { text, tone: "success" };
            case "decrease": return { text, tone: "warning" };
            case "avoid": return { text, tone: "critical" };
            case "maintain": return { text, tone: "info" };
            default: return { text: text || type, tone: "info" };
        }
    };

    const activeRecs = recommendations.filter(r => r.isActive);
    const dismissedRecs = recommendations.filter(r => !r.isActive);

    return (
        <s-page
            heading={t("rec.pageTitle")}
            backAction={{ url: "/app" }}
        >
            <div className="sda-hero">
                <svg className="sda-hero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                </svg>
                <h2 className="sda-hero-title">{t("rec.hero.title")}</h2>
                <p className="sda-hero-desc">
                    {t("rec.hero.desc")}
                </p>
                <div className="sda-cta-group">
                    <s-button
                        variant="primary"
                        onClick={handleGenerate}
                        {...(isGenerating ? { loading: true } : {})}
                    >
                        {t("rec.generate")}
                    </s-button>
                    <a href="/app/recommendations/export" target="_blank" rel="noopener noreferrer" className="sda-cta-secondary">
                        {t("rec.exportCsv")}
                    </a>
                </div>
            </div>

            <s-section heading={t("rec.sectionActive")}>
                {activeRecs.length > 0 ? (
                    <s-stack gap="base">
                        {activeRecs.map((rec) => {
                            const label = getRecommendationLabel(rec.recommendationType);
                            return (
                                <div key={rec.id} className={`sda-rec-card ${rec.recommendationType}`}>
                                <s-card>
                                    <s-stack gap="base">
                                        <s-stack direction="inline" align="center" gap="base">
                                            <s-stack gap="none" style={{ flex: 1 }}>
                                                <s-text variant="headingMd">{rec.productTitle}</s-text>
                                                <s-badge tone={label.tone}>{label.text}</s-badge>
                                            </s-stack>
                                            {!rec.isApplied && rec.recommendationType !== "avoid" && (rec.suggestedDiscountPercent ?? 0) > 0 && (
                                                <s-button variant="primary" onClick={() => handleApply(rec.id)}>
                                                    {t("rec.apply")}
                                                </s-button>
                                            )}
                                            {rec.isApplied && (
                                                <s-badge tone="success">{t("rec.applied")}</s-badge>
                                            )}
                                            <s-button variant="tertiary" onClick={() => handleDismiss(rec.id)}>
                                                {t("rec.dismiss")}
                                            </s-button>
                                        </s-stack>

                                        <s-grid columns="3" gap="tight">
                                            {rec.suggestedDiscountPercent !== null && (
                                                <s-stack gap="none">
                                                    <s-text variant="bodySm" tone="subdued">{t("rec.suggestedDiscount")}</s-text>
                                                    <s-text variant="headingSm">{rec.suggestedDiscountPercent}%</s-text>
                                                </s-stack>
                                            )}
                                            {rec.expectedRoi !== null && (
                                                <s-stack gap="none">
                                                    <s-text variant="bodySm" tone="subdued">{t("rec.expectedRoi")}</s-text>
                                                    <s-text variant="headingSm" tone={rec.expectedRoi >= 0 ? "success" : "critical"}>
                                                        {rec.expectedRoi >= 0 ? '+' : ''}{rec.expectedRoi.toFixed(1)}%
                                                    </s-text>
                                                </s-stack>
                                            )}
                                            <s-stack gap="none">
                                                <s-text variant="bodySm" tone="subdued">{t("rec.confidence")}</s-text>
                                                <s-text variant="headingSm">{Math.round(rec.confidenceLevel * 100)}%</s-text>
                                            </s-stack>
                                        </s-grid>

                                        {(rec.reasoningKey || rec.reasoning) && (
                                            <s-stack gap="none" className="sda-reasoning-block">
                                                <s-text variant="bodySm" fontWeight="semibold" tone="subdued">{t("rec.why")}:</s-text>
                                                <s-text variant="bodySm" tone="subdued">
                                                    {rec.reasoningKey ? t("reasoning." + rec.reasoningKey) : rec.reasoning}
                                                </s-text>
                                            </s-stack>
                                        )}
                                    </s-stack>
                                </s-card>
                                </div>
                            );
                        })}
                    </s-stack>
                ) : (
                    <div className="sda-empty">
                        <span className="sda-empty-icon" aria-hidden>✨</span>
                        <p className="sda-empty-title">{t("rec.empty.title")}</p>
                        <p className="sda-empty-desc">
                            {t("rec.empty.desc")}
                        </p>
                        <s-button variant="primary" onClick={handleGenerate} {...(isGenerating ? { loading: true } : {})}>
                            {t("rec.generate")}
                        </s-button>
                    </div>
                )}
            </s-section>

            {/* Product Performance Overview */}
            <s-section slot="aside" heading={t("rec.sectionProductPerf")}>
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
                        {t("rec.empty.noProducts")}
                    </s-paragraph>
                )}
            </s-section>

            {dismissedRecs.length > 0 && (
                <s-section slot="aside" heading={t("rec.sectionDismissed")}>
                    <s-text variant="bodySm" tone="subdued">
                        {t("rec.dismissedCount", { count: dismissedRecs.length })}
                    </s-text>
                </s-section>
            )}
        </s-page>
    );
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
