import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { getTForLocale } from "../i18n/translations";

export const loader = async ({ request }) => {
  try {
    const { billing, session } = await authenticate.admin(request);
    const isTest = process.env.NODE_ENV !== "production";
    await billing.require({
      plans: [MONTHLY_PLAN],
      isTest,
      onFailure: async () => billing.request({ plan: MONTHLY_PLAN, isTest }),
    });
    const shop = await prisma.shop.findUnique({
      where: { shopDomain: session.shop },
    });
    const locale = shop?.locale ?? "en";
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      locale,
    };
  } catch (error) {
    console.error("[app.jsx loader]", error?.message || error);
    throw error;
  }
};

export default function App() {
  const { apiKey, locale } = useLoaderData();
  const t = getTForLocale(locale);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">{t("nav.dashboard")}</s-link>
        <s-link href="/app/discounts">{t("nav.discountHistory")}</s-link>
        <s-link href="/app/recommendations">{t("nav.recommendations")}</s-link>
        <s-link href="/app/settings">{t("nav.settings")}</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
