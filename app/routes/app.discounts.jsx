/**
 * Discount History Page
 * Shows all discount codes with detailed analysis
 */

import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getTForLocale } from "../i18n/translations";

const DISCOUNTS_PER_PAGE = 20;

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    const shop = await prisma.shop.findUnique({
        where: { shopDomain }
    });

    if (!shop) {
        return { discounts: [], shop: null, totalCount: 0, page: 1, totalPages: 0 };
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const skip = (page - 1) * DISCOUNTS_PER_PAGE;

    const [totalCount, discounts] = await Promise.all([
        prisma.discountAnalysis.count({ where: { shopId: shop.id } }),
        prisma.discountAnalysis.findMany({
            where: { shopId: shop.id },
            orderBy: { updatedAt: "desc" },
            take: DISCOUNTS_PER_PAGE,
            skip
        })
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / DISCOUNTS_PER_PAGE));

    const locale = shop?.locale ?? "en";
    return {
        shop,
        locale,
        totalCount,
        page,
        totalPages,
        discounts: discounts.map(d => ({
            ...d,
            startDate: d.startDate.toISOString(),
            endDate: d.endDate?.toISOString() || null,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString()
        }))
    };
};

const localeToDateFormat = { en: "en-US", pl: "pl-PL", es: "es-ES", de: "de-DE" };

export default function DiscountHistory() {
    const { shop, discounts, totalCount, page, totalPages, locale } = useLoaderData();
    const t = getTForLocale(locale ?? "en");
    const dateLocale = localeToDateFormat[locale] || "en-US";

    const formatCurrency = (value) => {
        return new Intl.NumberFormat(dateLocale, {
            style: "currency",
            currency: shop?.currency || "PLN"
        }).format(value);
    };

    const formatPercent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString(dateLocale);
    };

    return (
        <s-page
            heading={t("discounts.title")}
            backAction={{ url: "/app" }}
        >
            <div className="sda-hero" style={{ marginBottom: "1rem" }}>
                <p className="sda-hero-desc" style={{ marginBottom: "0.75rem" }}>
                    {t("discounts.hero.desc")}
                </p>
                <div className="sda-cta-group">
                    <a href="/app/discounts/export" target="_blank" rel="noopener noreferrer" className="sda-cta-primary">
                        {t("discounts.exportCsv")}
                    </a>
                    <a href="/app" className="sda-cta-secondary">
                        {t("discounts.syncData")}
                    </a>
                </div>
            </div>
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
                                                    ? t("discounts.percentOff", { value: discount.discountValue })
                                                    : t("discounts.fixedOff", { value: formatCurrency(discount.discountValue) })
                                                }
                                            </s-text>
                                        </s-stack>
                                        <s-badge tone={discount.isProfitable ? "success" : "critical"}>
                                            {discount.isProfitable ? t("discounts.profitable") : t("discounts.unprofitable")}
                                        </s-badge>
                                    </s-stack>

                                    {/* Metrics Grid */}
                                    <s-grid columns="4" gap="tight">
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">{t("discounts.orders")}</s-text>
                                            <s-text variant="headingSm">{discount.totalOrders}</s-text>
                                        </s-stack>
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">{t("discounts.revenue")}</s-text>
                                            <s-text variant="headingSm">{formatCurrency(discount.totalRevenue)}</s-text>
                                        </s-stack>
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">{t("discounts.profit")}</s-text>
                                            <s-text variant="headingSm" tone={discount.totalProfit >= 0 ? "success" : "critical"}>
                                                {formatCurrency(discount.totalProfit)}
                                            </s-text>
                                        </s-stack>
                                        <s-stack gap="none">
                                            <s-text variant="bodySm" tone="subdued">{t("discounts.roi")}</s-text>
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
                                            {t("discounts.profitabilityScore")}: {discount.profitabilityScore}/100
                                        </s-text>
                                        <s-progress-bar progress={discount.profitabilityScore} />
                                    </s-stack>
                                </s-stack>
                            </s-card>
                        ))}
                    </s-stack>
                ) : null}
                {(totalCount > 0 || totalPages > 1) && (
                    <s-stack gap="tight" style={{ marginTop: "1.5rem" }}>
                        <s-text variant="bodySm" tone="subdued">
                            {t("discounts.pageOf", { page, totalPages, totalCount })}
                        </s-text>
                        {totalPages > 1 && (
                            <s-stack direction="inline" gap="tight">
                                {page > 1 && (
                                    <s-link href={`/app/discounts?page=${page - 1}`}>← {t("discounts.prev")}</s-link>
                                )}
                                {page < totalPages && (
                                    <s-link href={`/app/discounts?page=${page + 1}`}>{t("discounts.next")} →</s-link>
                                )}
                            </s-stack>
                        )}
                    </s-stack>
                )}
                {discounts.length === 0 && totalPages === 0 && (
                    <div className="sda-empty">
                        <span className="sda-empty-icon" aria-hidden>📊</span>
                        <p className="sda-empty-title">{t("discounts.empty.title")}</p>
                        <p className="sda-empty-desc">
                            {t("discounts.empty.desc")}
                        </p>
                        <a href="/app" className="sda-cta-primary">{t("discounts.empty.gotoDashboard")}</a>
                    </div>
                )}
                {discounts.length === 0 && totalPages > 0 && (
                    <s-empty-state heading={t("discounts.empty.title")}>
                        <s-paragraph>
                            <s-link href="/app/discounts?page=1">{t("discounts.empty.backToPage1")}</s-link>
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
