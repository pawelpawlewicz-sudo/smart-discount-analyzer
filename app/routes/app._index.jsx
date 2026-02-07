/**
 * Discount Intelligence - Main Dashboard
 * Shows KPIs, discount performance, and recommendations
 */

import { useEffect, useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { performFullSync } from "../services/data-sync";
import { getTForLocale } from "../i18n/translations";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get or create shop
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

  // Get discount analyses
  const discountAnalyses = await prisma.discountAnalysis.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: "desc" },
    take: 10
  });

  // Get recommendations
  const recommendations = await prisma.recommendation.findMany({
    where: { shopId: shop.id, isActive: true },
    orderBy: { confidenceLevel: "desc" },
    take: 5
  });

  // Calculate KPIs
  const totalDiscounts = discountAnalyses.length;
  const profitableDiscounts = discountAnalyses.filter(d => d.isProfitable).length;
  const profitablePercentage = totalDiscounts > 0
    ? Math.round((profitableDiscounts / totalDiscounts) * 100)
    : 0;

  const totalProfit = discountAnalyses.reduce((sum, d) => sum + d.totalProfit, 0);
  const totalRevenue = discountAnalyses.reduce((sum, d) => sum + d.totalRevenue, 0);
  const totalDiscountAmount = discountAnalyses.reduce((sum, d) => sum + d.totalDiscount, 0);

  const avgROI = discountAnalyses.length > 0
    ? discountAnalyses.reduce((sum, d) => sum + (d.roiPercentage || 0), 0) / discountAnalyses.length
    : 0;

  // Get last sync
  const lastSync = await prisma.syncLog.findFirst({
    where: { shopId: shop.id, status: "completed" },
    orderBy: { completedAt: "desc" }
  });

  const locale = shop?.locale ?? "en";
  return {
    shop,
    locale,
    kpis: {
      totalDiscounts,
      profitableDiscounts,
      profitablePercentage,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      avgROI: Math.round(avgROI * 10) / 10
    },
    discountAnalyses: discountAnalyses.map(d => ({
      ...d,
      startDate: d.startDate.toISOString(),
      endDate: d.endDate?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString()
    })),
    recommendations: recommendations.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    })),
    lastSync: lastSync ? {
      completedAt: lastSync.completedAt?.toISOString(),
      ordersProcessed: lastSync.ordersProcessed,
      discountsProcessed: lastSync.discountsProcessed
    } : null
  };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "sync") {
    try {
      const result = await performFullSync(admin, session.shop);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: "Unknown action" };
};

const localeToDateFormat = { en: "en-US", pl: "pl-PL", es: "es-ES", de: "de-DE" };

export default function Dashboard() {
  const { shop, kpis, discountAnalyses, recommendations, lastSync, locale } = useLoaderData();
  const t = getTForLocale(locale ?? "en");
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSyncing = fetcher.state === "submitting" && fetcher.formData?.get("action") === "sync";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(t("success.syncDone") || "Sync complete");
    } else if (fetcher.data?.error) {
      shopify.toast.show(`${t("error.generic")}: ${fetcher.data.error}`, { isError: true });
    }
  }, [fetcher.data, shopify, t]);

  const handleSync = () => {
    fetcher.submit({ action: "sync" }, { method: "POST" });
  };

  const dateLocale = localeToDateFormat[locale] || "en-US";
  const formatCurrency = (value) => {
    return new Intl.NumberFormat(dateLocale, {
      style: 'currency',
      currency: shop.currency || 'PLN'
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  // Get status color
  const getStatusColor = (isProfitable, score) => {
    if (isProfitable && score >= 70) return "success";
    if (isProfitable && score >= 50) return "warning";
    return "critical";
  };

  return (
    <s-page heading={t("dashboard.title")}>
      <div className="sda-hero">
        <svg className="sda-hero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5-4-4-3 3" />
        </svg>
        <h2 className="sda-hero-title">{t("dashboard.hero.title")}</h2>
        <p className="sda-hero-desc">
          {t("dashboard.hero.desc")}
        </p>
        <div className="sda-cta-group">
          <s-button
            variant="primary"
            onClick={handleSync}
            {...(isSyncing ? { loading: true } : {})}
          >
            {t("dashboard.sync")}
          </s-button>
          <a href="/app/recommendations" className="sda-cta-secondary">
            {t("dashboard.generateRecommendations")}
          </a>
        </div>
      </div>

      <s-section>
        <s-paragraph tone="subdued">
          {lastSync ? (
            <>{t("dashboard.lastSync")}: <strong>{new Date(lastSync.completedAt).toLocaleString(dateLocale)}</strong> ({t("dashboard.ordersAndDiscounts", { orders: lastSync.ordersProcessed, discounts: lastSync.discountsProcessed })})</>
          ) : (
            t("dashboard.lastSyncNever")
          )}
        </s-paragraph>
      </s-section>

      <s-section heading={t("dashboard.sectionProfitability")}>
        <div className="sda-kpi-grid">
          <div className="sda-kpi-card">
            <div className="sda-kpi-label">{t("dashboard.kpi.profitImpact")}</div>
            <div className={`sda-kpi-value ${kpis.totalProfit >= 0 ? "success" : "critical"}`}>
              {formatCurrency(kpis.totalProfit)}
            </div>
            <div className="sda-kpi-meta">{t("dashboard.kpi.fromDiscounts", { count: kpis.totalDiscounts })}</div>
          </div>
          <div className="sda-kpi-card">
            <div className="sda-kpi-label">{t("dashboard.kpi.profitableDiscounts")}</div>
            <div className={`sda-kpi-value ${kpis.profitablePercentage >= 50 ? "success" : "warning"}`}>
              {kpis.profitablePercentage}%
            </div>
            <div className="sda-kpi-meta">{t("dashboard.kpi.ofTotal", { a: kpis.profitableDiscounts, b: kpis.totalDiscounts })}</div>
          </div>
          <div className="sda-kpi-card">
            <div className="sda-kpi-label">{t("dashboard.kpi.avgROI")}</div>
            <div className={`sda-kpi-value ${kpis.avgROI >= 0 ? "success" : "critical"}`}>
              {formatPercent(kpis.avgROI)}
            </div>
            <div className="sda-kpi-meta">{t("dashboard.kpi.roiReturn")}</div>
          </div>
          <div className="sda-kpi-card">
            <div className="sda-kpi-label">{t("dashboard.kpi.discountsGiven")}</div>
            <div className="sda-kpi-value">{formatCurrency(kpis.totalDiscountAmount)}</div>
            <div className="sda-kpi-meta">{t("dashboard.kpi.revenue")}: {formatCurrency(kpis.totalRevenue)}</div>
          </div>
        </div>
      </s-section>

      <s-section heading={t("dashboard.sectionAnalysis")}>
        {discountAnalyses.length > 0 ? (
          <s-data-table>
            <s-heading slot="heading">
              <s-text>{t("dashboard.table.code")}</s-text>
              <s-text>{t("dashboard.table.orders")}</s-text>
              <s-text>{t("dashboard.table.revenue")}</s-text>
              <s-text>{t("dashboard.table.profit")}</s-text>
              <s-text>{t("dashboard.table.roi")}</s-text>
              <s-text>{t("dashboard.table.status")}</s-text>
            </s-heading>
            {discountAnalyses.map((discount) => (
              <s-row key={discount.id}>
                <s-text variant="bodyMd" fontWeight="bold">
                  {discount.discountCode}
                </s-text>
                <s-text>{discount.totalOrders}</s-text>
                <s-text>{formatCurrency(discount.totalRevenue)}</s-text>
                <s-text tone={discount.totalProfit >= 0 ? "success" : "critical"}>
                  {formatCurrency(discount.totalProfit)}
                </s-text>
                <s-text tone={discount.roiPercentage >= 0 ? "success" : "critical"}>
                  {discount.roiPercentage ? formatPercent(discount.roiPercentage) : "N/A"}
                </s-text>
                <s-badge tone={getStatusColor(discount.isProfitable, discount.profitabilityScore)}>
                  {discount.isProfitable ? t("dashboard.status.profitable") : t("dashboard.status.unprofitable")}
                </s-badge>
              </s-row>
            ))}
          </s-data-table>
        ) : (
          <div className="sda-empty">
            <span className="sda-empty-icon" aria-hidden>📉</span>
            <p className="sda-empty-title">{t("dashboard.empty.noDiscounts")}</p>
            <p className="sda-empty-desc">
              {t("dashboard.empty.syncFirst")}
            </p>
          </div>
        )}
      </s-section>

      <s-section slot="aside" heading={t("dashboard.sectionRecommendations")}>
        {recommendations.length > 0 ? (
          <s-stack gap="base">
            {recommendations.map((rec) => (
              <div key={rec.id} className={`sda-rec-card ${rec.recommendationType}`}>
              <s-card>
                <s-stack gap="tight">
                  <s-text variant="headingSm">{rec.productTitle}</s-text>
                  <s-badge tone={
                    rec.recommendationType === "increase" ? "success" :
                      rec.recommendationType === "avoid" ? "critical" :
                        rec.recommendationType === "decrease" ? "warning" : "info"
                  }>
                    {t("recType." + rec.recommendationType)}
                  </s-badge>
                  {rec.suggestedDiscountPercent != null && (
                    <s-text variant="bodySm">
                      {t("dashboard.rec.suggestedDiscount")}: {rec.suggestedDiscountPercent}%
                    </s-text>
                  )}
                  {(rec.reasoningKey || rec.reasoning) && (
                    <s-stack gap="none">
                      <s-text variant="bodySm" fontWeight="semibold" tone="subdued">{t("dashboard.rec.why")}:</s-text>
                      <s-text variant="bodySm" tone="subdued">
                        {rec.reasoningKey ? t("reasoning." + rec.reasoningKey) : rec.reasoning}
                      </s-text>
                    </s-stack>
                  )}
                </s-stack>
              </s-card>
              </div>
            ))}
          </s-stack>
        ) : (
          <div className="sda-empty">
            <span className="sda-empty-icon" aria-hidden>💡</span>
            <p className="sda-empty-title">{t("dashboard.empty.noRecommendations")}</p>
            <p className="sda-empty-desc">
              {t("dashboard.empty.goGenerate")}
            </p>
            <a href="/app/recommendations" className="sda-cta-secondary">{t("dashboard.generateRecommendations")}</a>
          </div>
        )}
      </s-section>

      <s-section slot="aside" heading={t("dashboard.quickActions")}>
        <div className="sda-nav-cards">
          <a href="/app/discounts" className="sda-nav-card">
            <span className="sda-nav-card-icon" aria-hidden>📊</span>
            {t("dashboard.quick.discounts")}
          </a>
          <a href="/app/recommendations" className="sda-nav-card">
            <span className="sda-nav-card-icon" aria-hidden>✨</span>
            {t("dashboard.quick.recommendations")}
          </a>
          <a href="/app/settings" className="sda-nav-card">
            <span className="sda-nav-card-icon" aria-hidden>⚙️</span>
            {t("dashboard.quick.settings")}
          </a>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
