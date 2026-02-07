/**
 * Seed test data for Smart Discount Analyzer.
 * Usage: SHOP_DOMAIN=your-store.myshopify.com npx prisma db seed
 * (Omit SHOP_DOMAIN to use demo-store.myshopify.com; then open app once and re-run with your store.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let shopDomain = process.env.SHOP_DOMAIN;
  if (!shopDomain) {
    const existing = await prisma.shop.findFirst();
    shopDomain = existing?.shopDomain || "demo-store.myshopify.com";
    if (!existing) console.log("Brak sklepu w DB – tworzę", shopDomain, "(uruchom aplikację raz i podaj SHOP_DOMAIN=twoj-sklep.myshopify.com aby seedować swój sklep).");
  }

  const shop = await prisma.shop.upsert({
    where: { shopDomain },
    update: {},
    create: {
      shopDomain,
      defaultMargin: 30,
      currency: "PLN",
      lastSyncAt: new Date()
    }
  });

  console.log("Shop:", shop.shopDomain);

  await prisma.recommendation.deleteMany({ where: { shopId: shop.id } });
  await prisma.productDiscountPerformance.deleteMany({ where: { shopId: shop.id } });
  await prisma.discountAnalysis.deleteMany({ where: { shopId: shop.id } });
  await prisma.syncLog.deleteMany({ where: { shopId: shop.id } });

  // Sync log
  await prisma.syncLog.create({
    data: {
      shopId: shop.id,
      syncType: "full",
      status: "completed",
      ordersProcessed: 142,
      productsProcessed: 28,
      discountsProcessed: 6,
      completedAt: new Date(Date.now() - 1000 * 60 * 15)
    }
  });

  // Discount analyses
  const discounts = [
    { code: "WIOSNA20", type: "percentage", value: 20, orders: 45, revenue: 12450, cost: 6800, profit: 5650, discount: 3112, roi: 81.4, profitable: true, score: 91 },
    { code: "WELCOME10", type: "percentage", value: 10, orders: 89, revenue: 22300, cost: 12500, profit: 9800, discount: 2230, roi: 339, profitable: true, score: 100 },
    { code: "BLACKFRIDAY", type: "percentage", value: 30, orders: 120, revenue: 28500, cost: 18000, profit: 10500, discount: 8550, roi: 22.8, profitable: true, score: 61 },
    { code: "DARMOWADOSTAWA", type: "fixed_amount", value: 15, orders: 67, revenue: 18900, cost: 10200, profit: 8700, discount: 1005, roi: 765, profitable: true, score: 100 },
    { code: "STARY30", type: "percentage", value: 30, orders: 12, revenue: 2400, cost: 1800, profit: 600, discount: 720, roi: -16.7, profitable: false, score: 33 },
    { code: "TEST50", type: "percentage", value: 50, orders: 8, revenue: 1200, cost: 900, profit: 300, discount: 600, roi: -50, profitable: false, score: 25 }
  ];

  const startBase = new Date();
  startBase.setDate(startBase.getDate() - 90);

  for (const d of discounts) {
    await prisma.discountAnalysis.create({
      data: {
        shopId: shop.id,
        discountCode: d.code,
        discountType: d.type,
        discountValue: d.value,
        startDate: startBase,
        endDate: new Date(),
        totalOrders: d.orders,
        totalRevenue: d.revenue,
        totalCost: d.cost,
        totalProfit: d.profit,
        totalDiscount: d.discount,
        avgOrderValue: d.revenue / d.orders,
        roiPercentage: d.roi,
        isProfitable: d.profitable,
        profitabilityScore: d.score
      }
    });
  }

  // Product performances (for recommendations)
  const productIds = [
    "gid://shopify/Product/1001",
    "gid://shopify/Product/1002",
    "gid://shopify/Product/1003",
    "gid://shopify/Product/1004",
    "gid://shopify/Product/1005"
  ];
  const products = [
    { title: "Kurtka zimowa Premium", price: 449, cost: 220, margin: 51, unitsWith: 34, unitsWithout: 12, score: 78 },
    { title: "Bluza z kapturem", price: 159, cost: 65, margin: 59, unitsWith: 89, unitsWithout: 41, score: 85 },
    { title: "Spodnie chino", price: 229, cost: 95, margin: 58, unitsWith: 22, unitsWithout: 18, score: 52 },
    { title: "Koszulka basic", price: 79, cost: 28, margin: 65, unitsWith: 156, unitsWithout: 98, score: 92 },
    { title: "Płaszcz wełniany", price: 599, cost: 320, margin: 47, unitsWith: 8, unitsWithout: 5, score: 41 }
  ];

  for (let i = 0; i < productIds.length; i++) {
    const p = products[i];
    const perfId = `seed-p${i}-${shop.id}`.slice(0, 36);
    await prisma.productDiscountPerformance.upsert({
      where: { id: perfId },
      update: {},
      create: {
        id: perfId,
        shopId: shop.id,
        shopifyProductId: productIds[i],
        productTitle: p.title,
        regularPrice: p.price,
        costPerItem: p.cost,
        margin: p.margin,
        unitsSoldWithDiscount: p.unitsWith,
        unitsSoldWithoutDiscount: p.unitsWithout,
        revenueWithDiscount: p.unitsWith * p.price * 0.85,
        revenueWithoutDiscount: p.unitsWithout * p.price,
        profitWithDiscount: p.unitsWith * (p.price * 0.85 - p.cost),
        profitWithoutDiscount: p.unitsWithout * (p.price - p.cost),
        profitabilityScore: p.score,
        recommendedDiscountLevel: p.score > 70 ? 15 : p.score > 50 ? 10 : 5
      }
    });
  }

  // Recommendations
  const recs = [
    { productId: productIds[0], title: products[0].title, type: "increase", percent: 20, roi: 12, confidence: 0.7, reasoning: "Wysoka elastyczność cenowa i pozytywny ROI." },
    { productId: productIds[1], title: products[1].title, type: "maintain", percent: 15, roi: 8, confidence: 0.6, reasoning: "Obecny poziom rabatu jest umiarkowanie opłacalny." },
    { productId: productIds[2], title: products[2].title, type: "decrease", percent: 5, roi: -5, confidence: 0.6, reasoning: "Zmniejsz rabat dla lepszej rentowności." },
    { productId: productIds[3], title: products[3].title, type: "increase", percent: 25, roi: 18, confidence: 0.8, reasoning: "Bestseller, zwiększenie rabatu może podbić wolumen." },
    { productId: productIds[4], title: products[4].title, type: "avoid", percent: 0, roi: -12, confidence: 0.8, reasoning: "Rabaty na ten produkt przynoszą straty." }
  ];

  for (const r of recs) {
    await prisma.recommendation.create({
      data: {
        shopId: shop.id,
        shopifyProductId: r.productId,
        productTitle: r.title,
        recommendationType: r.type,
        suggestedDiscountPercent: r.percent,
        expectedRoi: r.roi,
        confidenceLevel: r.confidence,
        reasoning: r.reasoning,
        isActive: true,
        isApplied: r.type === "increase" && r.productId === productIds[3],
        appliedAt: r.type === "increase" && r.productId === productIds[3] ? new Date() : null
      }
    });
  }

  console.log("Seed done: 6 discounts, 5 products, 5 recommendations, 1 sync log.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
