/**
 * Export recommendations as CSV (no UI, returns file)
 */
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { buildCsv } from "../utils/csv";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const shop = await prisma.shop.findUnique({
        where: { shopDomain: session.shop }
    });
    if (!shop) {
        return new Response("Brak danych", { status: 404 });
    }

    const recommendations = await prisma.recommendation.findMany({
        where: { shopId: shop.id },
        orderBy: [{ isActive: "desc" }, { confidenceLevel: "desc" }]
    });

    const headers = [
        "Produkt",
        "Typ rekomendacji",
        "Sugerowany rabat %",
        "Oczekiwany ROI %",
        "Pewność",
        "Uzasadnienie",
        "Aktywna",
        "Zastosowano",
        "Data zastosowania"
    ];
    const rows = recommendations.map((r) => [
        r.productTitle,
        r.recommendationType,
        r.suggestedDiscountPercent != null ? r.suggestedDiscountPercent : "",
        r.expectedRoi != null ? r.expectedRoi.toFixed(1) : "",
        (r.confidenceLevel * 100).toFixed(0),
        r.reasoning ?? "",
        r.isActive ? "Tak" : "Nie",
        r.isApplied ? "Tak" : "Nie",
        r.appliedAt ? r.appliedAt.toISOString().slice(0, 10) : ""
    ]);

    const csv = buildCsv(headers, rows);

    const bom = "\uFEFF";
    return new Response(bom + csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="rekomendacje.csv"'
        }
    });
}
