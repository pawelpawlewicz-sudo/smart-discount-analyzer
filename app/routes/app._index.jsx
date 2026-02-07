/**
 * Smart Discount Analyzer - Main Dashboard
 * Shows KPIs, discount performance, and recommendations
 */

import { useEffect, useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { performFullSync } from "../services/data-sync";

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

  return {
    shop,
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

export default function Dashboard() {
  const { shop, kpis, discountAnalyses, recommendations, lastSync } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isSyncing = fetcher.state === "submitting" && fetcher.formData?.get("action") === "sync";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Synchronizacja zakończona!");
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Błąd: ${fetcher.data.error}`, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleSync = () => {
    fetcher.submit({ action: "sync" }, { method: "POST" });
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pl-PL', {
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
    <s-page heading="Smart Discount Analyzer">
      <s-button
        slot="primary-action"
        onClick={handleSync}
        {...(isSyncing ? { loading: true } : {})}
      >
        Synchronizuj dane
      </s-button>

      {/* KPI Section */}
      <s-section heading="Przegląd rentowności rabatów">
        <s-stack gap="loose">
          <s-paragraph>
            {lastSync ? (
              <>
                Ostatnia synchronizacja: {new Date(lastSync.completedAt).toLocaleString('pl-PL')}
                ({lastSync.ordersProcessed} zamówień, {lastSync.discountsProcessed} rabatów)
              </>
            ) : (
              "Brak synchronizacji. Kliknij 'Synchronizuj dane' aby pobrać historię rabatów."
            )}
          </s-paragraph>

          <s-grid columns="4" gap="base">
            {/* Total Profit Impact */}
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">Wpływ na zysk</s-text>
                <s-text variant="heading2xl" tone={kpis.totalProfit >= 0 ? "success" : "critical"}>
                  {formatCurrency(kpis.totalProfit)}
                </s-text>
                <s-text variant="bodySm" tone="subdued">
                  z {kpis.totalDiscounts} rabatów
                </s-text>
              </s-stack>
            </s-card>

            {/* Profitable Percentage */}
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">Opłacalne rabaty</s-text>
                <s-text variant="heading2xl" tone={kpis.profitablePercentage >= 50 ? "success" : "warning"}>
                  {kpis.profitablePercentage}%
                </s-text>
                <s-text variant="bodySm" tone="subdued">
                  {kpis.profitableDiscounts} z {kpis.totalDiscounts}
                </s-text>
              </s-stack>
            </s-card>

            {/* Average ROI */}
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">Średni ROI</s-text>
                <s-text variant="heading2xl" tone={kpis.avgROI >= 0 ? "success" : "critical"}>
                  {formatPercent(kpis.avgROI)}
                </s-text>
                <s-text variant="bodySm" tone="subdued">
                  zwrot z inwestycji w rabaty
                </s-text>
              </s-stack>
            </s-card>

            {/* Total Discount Given */}
            <s-card>
              <s-stack gap="tight">
                <s-text variant="headingMd">Udzielone rabaty</s-text>
                <s-text variant="heading2xl">
                  {formatCurrency(kpis.totalDiscountAmount)}
                </s-text>
                <s-text variant="bodySm" tone="subdued">
                  przychód: {formatCurrency(kpis.totalRevenue)}
                </s-text>
              </s-stack>
            </s-card>
          </s-grid>
        </s-stack>
      </s-section>

      {/* Discount Analysis Table */}
      <s-section heading="Analiza rabatów">
        {discountAnalyses.length > 0 ? (
          <s-data-table>
            <s-heading slot="heading">
              <s-text>Kod rabatowy</s-text>
              <s-text>Zamówienia</s-text>
              <s-text>Przychód</s-text>
              <s-text>Zysk</s-text>
              <s-text>ROI</s-text>
              <s-text>Status</s-text>
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
                  {discount.isProfitable ? "Opłacalny" : "Nieopłacalny"}
                </s-badge>
              </s-row>
            ))}
          </s-data-table>
        ) : (
          <s-empty-state heading="Brak danych o rabatach">
            <s-paragraph>
              Kliknij "Synchronizuj dane" aby pobrać historię rabatów z Twojego sklepu.
            </s-paragraph>
          </s-empty-state>
        )}
      </s-section>

      {/* Recommendations Section */}
      <s-section slot="aside" heading="Rekomendacje">
        {recommendations.length > 0 ? (
          <s-stack gap="base">
            {recommendations.map((rec) => (
              <s-card key={rec.id}>
                <s-stack gap="tight">
                  <s-text variant="headingSm">{rec.productTitle}</s-text>
                  <s-badge tone={
                    rec.recommendationType === "increase" ? "success" :
                      rec.recommendationType === "avoid" ? "critical" :
                        rec.recommendationType === "decrease" ? "warning" : "info"
                  }>
                    {rec.recommendationType === "increase" && "Zwiększ rabat"}
                    {rec.recommendationType === "decrease" && "Zmniejsz rabat"}
                    {rec.recommendationType === "avoid" && "Unikaj rabatów"}
                    {rec.recommendationType === "maintain" && "Utrzymaj"}
                  </s-badge>
                  {rec.suggestedDiscountPercent && (
                    <s-text variant="bodySm">
                      Sugerowany rabat: {rec.suggestedDiscountPercent}%
                    </s-text>
                  )}
                  {rec.reasoning && (
                    <s-text variant="bodySm" tone="subdued">
                      {rec.reasoning}
                    </s-text>
                  )}
                </s-stack>
              </s-card>
            ))}
          </s-stack>
        ) : (
          <s-paragraph tone="subdued">
            Rekomendacje pojawią się po pierwszej synchronizacji danych.
          </s-paragraph>
        )}
      </s-section>

      {/* Navigation Links */}
      <s-section slot="aside" heading="Nawigacja">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/discounts">Historia rabatów</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/recommendations">Rekomendacje produktowe</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/settings">Ustawienia</s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
