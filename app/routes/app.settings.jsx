/**
 * Settings Page
 * Configure app settings, import costs, manage sync
 */

import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getT, translations, getTForLocale } from "../i18n/translations";

export const loader = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    const shop = await prisma.shop.findUnique({
        where: { shopDomain }
    });

    // Get sync logs
    const syncLogs = await prisma.syncLog.findMany({
        where: { shopId: shop?.id },
        orderBy: { startedAt: "desc" },
        take: 10
    });

    const locale = shop?.locale ?? "en";
    return {
        shop: shop ? {
            ...shop,
            lastSyncAt: shop.lastSyncAt?.toISOString() || null,
            createdAt: shop.createdAt.toISOString(),
            updatedAt: shop.updatedAt.toISOString()
        } : null,
        locale,
        syncLogs: syncLogs.map(log => ({
            ...log,
            startedAt: log.startedAt.toISOString(),
            completedAt: log.completedAt?.toISOString() || null
        }))
    };
};

export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("action");

    if (actionType === "updateSettings") {
        const shop = await prisma.shop.findUnique({
            where: { shopDomain: session.shop }
        });
        const locale = shop?.locale ?? "en";
        const t = (key, params) => getT(translations)(locale, key, params);

        const rawMargin = formData.get("defaultMargin");
        const defaultMargin = rawMargin !== null && rawMargin !== "" ? parseFloat(rawMargin) : 30;
        const currency = (formData.get("currency") || "PLN").trim();
        const newLocale = (formData.get("locale") || "en").trim();
        const validLocales = ["en", "pl", "es", "de"];
        const validCurrencies = ["PLN", "EUR", "USD", "GBP"];

        if (Number.isNaN(defaultMargin) || defaultMargin < 1 || defaultMargin > 99) {
            return { success: false, error: t("error.settingsMargin") };
        }
        if (!validCurrencies.includes(currency)) {
            return { success: false, error: t("error.settingsCurrency") };
        }
        if (!validLocales.includes(newLocale)) {
            return { success: false, error: "Invalid locale." };
        }

        await prisma.shop.update({
            where: { shopDomain: session.shop },
            data: {
                defaultMargin,
                currency,
                locale: newLocale
            }
        });

        return { success: true, message: t("success.settingsSaved") };
    }

    if (actionType === "clearData") {
        const shop = await prisma.shop.findUnique({
            where: { shopDomain: session.shop }
        });

        if (shop) {
            await prisma.discountAnalysis.deleteMany({ where: { shopId: shop.id } });
            await prisma.productDiscountPerformance.deleteMany({ where: { shopId: shop.id } });
            await prisma.recommendation.deleteMany({ where: { shopId: shop.id } });
            await prisma.syncLog.deleteMany({ where: { shopId: shop.id } });
            const locale = shop.locale ?? "en";
            const t = (key) => getT(translations)(locale, key);
            return { success: true, message: t("success.dataCleared") };
        }

        return { success: false, error: "Shop not found" };
    }

    return { success: false, error: "Unknown action" };
};

export default function Settings() {
    const { shop, syncLogs, locale } = useLoaderData();
    const t = getTForLocale(locale ?? "en");
    const fetcher = useFetcher();
    const shopify = useAppBridge();

    const [defaultMargin, setDefaultMargin] = useState(shop?.defaultMargin || 30);
    const [currency, setCurrency] = useState(shop?.currency || "PLN");
    const [appLocale, setAppLocale] = useState(shop?.locale || "en");
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        if (shop?.locale) setAppLocale(shop.locale);
    }, [shop?.locale]);

    useEffect(() => {
        if (fetcher.data?.success) {
            shopify.toast.show(fetcher.data.message);
            setShowClearConfirm(false);
        } else if (fetcher.data?.error) {
            shopify.toast.show(`${t("error.generic")}: ${fetcher.data.error}`, { isError: true });
        }
    }, [fetcher.data, shopify, t]);

    const handleSaveSettings = () => {
        fetcher.submit(
            { action: "updateSettings", defaultMargin: defaultMargin.toString(), currency, locale: appLocale },
            { method: "POST" }
        );
    };

    const handleClearData = () => {
        fetcher.submit({ action: "clearData" }, { method: "POST" });
    };

    const dateLocale = { en: "en-US", pl: "pl-PL", es: "es-ES", de: "de-DE" }[locale] || "en-US";
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString(dateLocale);
    };

    return (
        <s-page
            heading={t("settings.title")}
            backAction={{ url: "/app" }}
        >
            <div className="sda-hero" style={{ marginBottom: "1.5rem" }}>
                <h2 className="sda-hero-title">{t("settings.hero.title")}</h2>
                <p className="sda-hero-desc">
                    {t("settings.hero.desc")}
                </p>
                <s-button variant="primary" onClick={handleSaveSettings} {...(fetcher.state === "submitting" ? { loading: true } : {})}>
                    {t("settings.save")}
                </s-button>
            </div>

            <s-section heading={t("settings.sectionMargin")}>
                <s-stack gap="base">
                    <s-paragraph>
                        {t("settings.marginDesc")}
                    </s-paragraph>

                    <s-stack direction="inline" gap="base" align="end">
                        <s-text-field
                            label={t("settings.marginLabel")}
                            type="number"
                            value={defaultMargin.toString()}
                            onChange={(e) => setDefaultMargin(parseFloat(e.target.value) || 30)}
                            min="1"
                            max="99"
                            suffix="%"
                        />

                        <s-select
                            label={t("settings.currency")}
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            options={[
                                { label: "PLN", value: "PLN" },
                                { label: "EUR", value: "EUR" },
                                { label: "USD", value: "USD" },
                                { label: "GBP", value: "GBP" }
                            ]}
                        />

                        <s-select
                            label={t("settings.locale")}
                            value={appLocale}
                            onChange={(e) => setAppLocale(e.target.value)}
                            options={[
                                { label: "English", value: "en" },
                                { label: "Polski", value: "pl" },
                                { label: "Español", value: "es" },
                                { label: "Deutsch", value: "de" }
                            ]}
                        />
                    </s-stack>
                </s-stack>
            </s-section>

            <s-section heading={t("settings.sectionCosts")}>
                <s-stack gap="base">
                    <s-paragraph>
                        {t("settings.costsDesc")}
                    </s-paragraph>
                    <s-link
                        href="https://help.shopify.com/en/manual/products/details/cost"
                        target="_blank"
                    >
                        {t("settings.learnMoreCosts")}
                    </s-link>
                </s-stack>
            </s-section>

            <s-section heading={t("settings.sectionSyncHistory")}>
                {syncLogs.length > 0 ? (
                    <s-data-table>
                        <s-heading slot="heading">
                            <s-text>{t("settings.table.date")}</s-text>
                            <s-text>{t("settings.table.type")}</s-text>
                            <s-text>{t("settings.table.status")}</s-text>
                            <s-text>{t("settings.table.processed")}</s-text>
                        </s-heading>
                        {syncLogs.map((log) => (
                            <s-row key={log.id}>
                                <s-text>{formatDate(log.startedAt)}</s-text>
                                <s-text>{log.syncType}</s-text>
                                <s-badge tone={log.status === "completed" ? "success" : log.status === "failed" ? "critical" : "info"}>
                                    {log.status === "completed" && t("settings.status.completed")}
                                    {log.status === "failed" && t("settings.status.failed")}
                                    {log.status === "in_progress" && t("settings.status.inProgress")}
                                </s-badge>
                                <s-text>
                                    {t("settings.ordersAndDiscounts", { orders: log.ordersProcessed, discounts: log.discountsProcessed })}
                                </s-text>
                            </s-row>
                        ))}
                    </s-data-table>
                ) : (
                    <s-paragraph tone="subdued">
                        {t("settings.noSyncHistory")}
                    </s-paragraph>
                )}
            </s-section>

            <s-section slot="aside" heading={t("settings.sectionShop")}>
                {shop ? (
                    <s-stack gap="tight">
                        <s-text variant="bodySm" tone="subdued">{t("settings.domain")}</s-text>
                        <s-text>{shop.shopDomain}</s-text>

                        <s-text variant="bodySm" tone="subdued">{t("settings.lastSync")}</s-text>
                        <s-text>{shop.lastSyncAt ? formatDate(shop.lastSyncAt) : t("settings.never")}</s-text>

                        <s-text variant="bodySm" tone="subdued">{t("settings.appInstalled")}</s-text>
                        <s-text>{formatDate(shop.createdAt)}</s-text>
                    </s-stack>
                ) : (
                    <s-paragraph tone="subdued">{t("settings.noShopData")}</s-paragraph>
                )}
            </s-section>

            <s-section slot="aside" heading={t("settings.sectionDanger")}>
                <s-stack gap="base">
                    <s-paragraph tone="subdued">
                        {t("settings.dangerDesc")}
                    </s-paragraph>

                    {!showClearConfirm ? (
                        <s-button variant="primary" tone="critical" onClick={() => setShowClearConfirm(true)}>
                            {t("settings.clearData")}
                        </s-button>
                    ) : (
                        <s-stack gap="tight">
                            <s-text tone="critical">{t("settings.clearConfirm")}</s-text>
                            <s-stack direction="inline" gap="tight">
                                <s-button tone="critical" onClick={handleClearData}>
                                    {t("settings.clearConfirmYes")}
                                </s-button>
                                <s-button variant="tertiary" onClick={() => setShowClearConfirm(false)}>
                                    {t("settings.cancel")}
                                </s-button>
                            </s-stack>
                        </s-stack>
                    )}
                </s-stack>
            </s-section>
        </s-page>
    );
}

export const headers = (headersArgs) => {
    return boundary.headers(headersArgs);
};
