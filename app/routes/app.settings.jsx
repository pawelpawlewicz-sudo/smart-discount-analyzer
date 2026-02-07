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

    return {
        shop: shop ? {
            ...shop,
            lastSyncAt: shop.lastSyncAt?.toISOString() || null,
            createdAt: shop.createdAt.toISOString(),
            updatedAt: shop.updatedAt.toISOString()
        } : null,
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
        const defaultMargin = parseFloat(formData.get("defaultMargin") || "30");
        const currency = formData.get("currency") || "PLN";

        await prisma.shop.update({
            where: { shopDomain: session.shop },
            data: {
                defaultMargin,
                currency
            }
        });

        return { success: true, message: "Ustawienia zapisane" };
    }

    if (actionType === "clearData") {
        const shop = await prisma.shop.findUnique({
            where: { shopDomain: session.shop }
        });

        if (shop) {
            // Clear all analysis data
            await prisma.discountAnalysis.deleteMany({ where: { shopId: shop.id } });
            await prisma.productDiscountPerformance.deleteMany({ where: { shopId: shop.id } });
            await prisma.recommendation.deleteMany({ where: { shopId: shop.id } });
            await prisma.syncLog.deleteMany({ where: { shopId: shop.id } });

            return { success: true, message: "Dane zostały wyczyszczone" };
        }

        return { success: false, error: "Shop not found" };
    }

    return { success: false, error: "Unknown action" };
};

export default function Settings() {
    const { shop, syncLogs } = useLoaderData();
    const fetcher = useFetcher();
    const shopify = useAppBridge();

    const [defaultMargin, setDefaultMargin] = useState(shop?.defaultMargin || 30);
    const [currency, setCurrency] = useState(shop?.currency || "PLN");
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        if (fetcher.data?.success) {
            shopify.toast.show(fetcher.data.message);
            setShowClearConfirm(false);
        } else if (fetcher.data?.error) {
            shopify.toast.show(`Błąd: ${fetcher.data.error}`, { isError: true });
        }
    }, [fetcher.data, shopify]);

    const handleSaveSettings = () => {
        fetcher.submit(
            { action: "updateSettings", defaultMargin: defaultMargin.toString(), currency },
            { method: "POST" }
        );
    };

    const handleClearData = () => {
        fetcher.submit({ action: "clearData" }, { method: "POST" });
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('pl-PL');
    };

    return (
        <s-page
            heading="Ustawienia"
            backAction={{ url: "/app" }}
        >
            <s-button
                slot="primary-action"
                onClick={handleSaveSettings}
                {...(fetcher.state === "submitting" ? { loading: true } : {})}
            >
                Zapisz ustawienia
            </s-button>

            {/* Default Margin Settings */}
            <s-section heading="Domyślna marża">
                <s-stack gap="base">
                    <s-paragraph>
                        Ustaw domyślną marżę produktową używaną do kalkulacji, gdy koszt produktu
                        nie jest zdefiniowany w Shopify.
                    </s-paragraph>

                    <s-stack direction="inline" gap="base" align="end">
                        <s-text-field
                            label="Domyślna marża (%)"
                            type="number"
                            value={defaultMargin.toString()}
                            onChange={(e) => setDefaultMargin(parseFloat(e.target.value) || 30)}
                            min="1"
                            max="99"
                            suffix="%"
                        />

                        <s-select
                            label="Waluta"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            options={[
                                { label: "PLN", value: "PLN" },
                                { label: "EUR", value: "EUR" },
                                { label: "USD", value: "USD" },
                                { label: "GBP", value: "GBP" }
                            ]}
                        />
                    </s-stack>
                </s-stack>
            </s-section>

            {/* Import Costs */}
            <s-section heading="Import kosztów produktów">
                <s-stack gap="base">
                    <s-paragraph>
                        Aby uzyskać dokładne kalkulacje rentowności, ustaw koszty produktów
                        bezpośrednio w Shopify Admin (Produkt → Wariant → Koszt za sztukę).
                    </s-paragraph>
                    <s-link
                        href="https://help.shopify.com/en/manual/products/details/cost"
                        target="_blank"
                    >
                        Dowiedz się więcej o ustawianiu kosztów produktów →
                    </s-link>
                </s-stack>
            </s-section>

            {/* Sync History */}
            <s-section heading="Historia synchronizacji">
                {syncLogs.length > 0 ? (
                    <s-data-table>
                        <s-heading slot="heading">
                            <s-text>Data</s-text>
                            <s-text>Typ</s-text>
                            <s-text>Status</s-text>
                            <s-text>Przetworzone</s-text>
                        </s-heading>
                        {syncLogs.map((log) => (
                            <s-row key={log.id}>
                                <s-text>{formatDate(log.startedAt)}</s-text>
                                <s-text>{log.syncType}</s-text>
                                <s-badge tone={log.status === "completed" ? "success" : log.status === "failed" ? "critical" : "info"}>
                                    {log.status === "completed" && "Ukończone"}
                                    {log.status === "failed" && "Błąd"}
                                    {log.status === "in_progress" && "W trakcie"}
                                </s-badge>
                                <s-text>
                                    {log.ordersProcessed} zamówień, {log.discountsProcessed} rabatów
                                </s-text>
                            </s-row>
                        ))}
                    </s-data-table>
                ) : (
                    <s-paragraph tone="subdued">
                        Brak historii synchronizacji.
                    </s-paragraph>
                )}
            </s-section>

            {/* Shop Info */}
            <s-section slot="aside" heading="Informacje o sklepie">
                {shop ? (
                    <s-stack gap="tight">
                        <s-text variant="bodySm" tone="subdued">Domena</s-text>
                        <s-text>{shop.shopDomain}</s-text>

                        <s-text variant="bodySm" tone="subdued">Ostatnia synchronizacja</s-text>
                        <s-text>{shop.lastSyncAt ? formatDate(shop.lastSyncAt) : "Nigdy"}</s-text>

                        <s-text variant="bodySm" tone="subdued">App zainstalowana</s-text>
                        <s-text>{formatDate(shop.createdAt)}</s-text>
                    </s-stack>
                ) : (
                    <s-paragraph tone="subdued">Brak danych o sklepie.</s-paragraph>
                )}
            </s-section>

            {/* Danger Zone */}
            <s-section slot="aside" heading="Strefa niebezpieczna">
                <s-stack gap="base">
                    <s-paragraph tone="subdued">
                        Wyczyść wszystkie dane analizy. Ta operacja jest nieodwracalna.
                    </s-paragraph>

                    {!showClearConfirm ? (
                        <s-button variant="primary" tone="critical" onClick={() => setShowClearConfirm(true)}>
                            Wyczyść dane
                        </s-button>
                    ) : (
                        <s-stack gap="tight">
                            <s-text tone="critical">Czy na pewno?</s-text>
                            <s-stack direction="inline" gap="tight">
                                <s-button tone="critical" onClick={handleClearData}>
                                    Tak, wyczyść
                                </s-button>
                                <s-button variant="tertiary" onClick={() => setShowClearConfirm(false)}>
                                    Anuluj
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
