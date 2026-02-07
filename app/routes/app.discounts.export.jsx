/**
 * Export discounts as CSV (no UI, returns file)
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

    const discounts = await prisma.discountAnalysis.findMany({
        where: { shopId: shop.id },
        orderBy: { updatedAt: "desc" }
    });

    const headers = [
        "Kod",
        "Typ",
        "Wartość",
        "Początek",
        "Koniec",
        "Zamówienia",
        "Przychód",
        "Koszt",
        "Zysk",
        "Rabat łącznie",
        "ROI %",
        "Opłacalny",
        "Wskaźnik rentowności"
    ];
    const rows = discounts.map((d) => [
        d.discountCode,
        d.discountType,
        d.discountValue,
        d.startDate.toISOString().slice(0, 10),
        d.endDate ? d.endDate.toISOString().slice(0, 10) : "",
        d.totalOrders,
        d.totalRevenue.toFixed(2),
        d.totalCost.toFixed(2),
        d.totalProfit.toFixed(2),
        d.totalDiscount.toFixed(2),
        d.roiPercentage != null ? d.roiPercentage.toFixed(1) : "",
        d.isProfitable ? "Tak" : "Nie",
        d.profitabilityScore
    ]);

    const csv = buildCsv(headers, rows);

    const bom = "\uFEFF";
    return new Response(bom + csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="rabaty.csv"'
        }
    });
}
