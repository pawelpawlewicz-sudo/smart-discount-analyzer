/**
 * Discount History Page
 * Shows all discount codes with detailed analysis
 */

import { useLoaderData, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    const shop = await prisma.shop.findUnique({
        where: { shopDomain }
    });

    if (!shop) {
        return { discounts: [], shop: null };
    }

    const discounts = await prisma.discountAnalysis.findMany({
        where: { shopId: shop.id },
        orderBy: { updatedAt: "desc" }
    });

    return {
        shop,
        discounts: discounts.map(d => ({
            ...d,
            startDate: d.startDate.toISOString(),
            endDate: d.endDate?.toISOString() || null,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString()
        }))
    };
};

export default function DiscountHistory() {
    const { shop, discounts } = useLoaderData();

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: shop?.currency || 'PLN'
        }).format(value);
    };

    const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pl-PL');
    };

    return (
        <s-page
            heading="Historia rabatów"
            backAction={{ url: "/app" }}
        >
            <s-section>
                {discounts.length > 0 ? (
                    <s-stack gap="base">
                        {discounts.map((discount) => (
                            <s-card key={discount.id}>
                                <s-stack gap="base">
                                    {/* Header */}
                                    <s-stack direction="inline" align="start" gap="base">
                                        <s-stack gap="none" style={{ flex: 1 }}>
                                            <s-text variant="headingMd">{discount.discountCode}</s-text>
                                            <s-text variant="bodySm" tone="subdued">
                                                {discount.discountType === "percentage"
                                                    ? `${discount.discountValue}% rabatu`
                                                    : `${formatCurrency(discount.discountValue)} rabatu`
                                                }
                                            </s-text>
                                        </s-stack>
                                        <s-badge tone={discount.isProfitable ? "success" : "critical"}>
                                            {discount.isProfitable ? "Opłacalny" : "Nieopłacalny"}
                                        </s-badge>
                                    </s-stack>

                                    {/* Metrics Grid */}
                                    <s-grid columns="4" gap="tight">
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">Zamówienia</s-text>
                                            <s-text variant="headingSm">{discount.totalOrders}</s-text>
                                        </s-stack>
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">Przychód</s-text>
                                            <s-text variant="headingSm">{formatCurrency(discount.totalRevenue)}</s-text>
                                        </s-stack>
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">Zysk</s-text>
                                            <s-text variant="headingSm" tone={discount.totalProfit >= 0 ? "success" : "critical"}>
                                                {formatCurrency(discount.totalProfit)}
                                            </s-text>
                                        </s-stack>
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">ROI</s-text>
                                            <s-text variant="headingSm" tone={discount.roiPercentage >= 0 ? "success" : "critical"}>
                                                {discount.roiPercentage ? formatPercent(discount.roiPercentage) : "N/A"}
                                            </s-text>
                                        </s-stack>
                                    </s-grid>

                                    {/* Date range */}
                                    <s-text variant="bodySm" tone="subdued">
                                        {formatDate(discount.startDate)}
                                        {discount.endDate && ` - ${formatDate(discount.endDate)}`}
                                    </s-text>

                                    {/* Profitability Score Bar */}
                                    <s-stack gap="tight">
                                        <s-text variant="bodySm" tone="subdued">
                                            Wskaźnik rentowności: {discount.profitabilityScore}/100
                                        </s-text>
                                        <s-progress-bar progress={discount.profitabilityScore} />
                                    </s-stack>
                                </s-stack>
                            </s-card>
                        ))}
                    </s-stack>
                ) : (
                    <s-empty-state heading="Brak historii rabatów">
                        <s-paragraph>
                            Przejdź do <s-link href="/app">Dashboard</s-link> i kliknij "Synchronizuj dane"
                            aby pobrać historię rabatów.
                        </s-paragraph>
                    </s-empty-state>
                )}
            </s-section>
        </s-page>
    );
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
