-- Discount Intelligence: initial schema for PostgreSQL (production / Railway)
-- Run with: DATABASE_URL="postgresql://..." npx prisma migrate deploy

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN,
    "emailVerified" BOOLEAN,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shop" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shopDomain" TEXT NOT NULL,
    "defaultMargin" DOUBLE PRECISION DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountAnalysis" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shopId" TEXT NOT NULL,
    "discountCode" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "roiPercentage" DOUBLE PRECISION,
    "isProfitable" BOOLEAN NOT NULL DEFAULT false,
    "profitabilityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductDiscountPerformance" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shopId" TEXT NOT NULL,
    "discountAnalysisId" TEXT,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productCategory" TEXT,
    "regularPrice" DOUBLE PRECISION NOT NULL,
    "costPerItem" DOUBLE PRECISION,
    "margin" DOUBLE PRECISION,
    "unitsSoldWithDiscount" INTEGER NOT NULL DEFAULT 0,
    "unitsSoldWithoutDiscount" INTEGER NOT NULL DEFAULT 0,
    "revenueWithDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueWithoutDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitWithDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitWithoutDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendedDiscountLevel" DOUBLE PRECISION,
    "breakevenMultiplier" DOUBLE PRECISION,
    "priceElasticity" DOUBLE PRECISION,
    "profitabilityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDiscountPerformance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "suggestedDiscountPercent" DOUBLE PRECISION,
    "expectedRoi" DOUBLE PRECISION,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "reasoning" TEXT,
    "reasoningKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "shopId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ordersProcessed" INTEGER NOT NULL DEFAULT 0,
    "productsProcessed" INTEGER NOT NULL DEFAULT 0,
    "discountsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
CREATE UNIQUE INDEX "Recommendation_shopId_shopifyProductId_key" ON "Recommendation"("shopId", "shopifyProductId");

CREATE INDEX "DiscountAnalysis_shopId_idx" ON "DiscountAnalysis"("shopId");
CREATE INDEX "DiscountAnalysis_discountCode_idx" ON "DiscountAnalysis"("discountCode");
CREATE INDEX "ProductDiscountPerformance_shopId_idx" ON "ProductDiscountPerformance"("shopId");
CREATE INDEX "ProductDiscountPerformance_shopifyProductId_idx" ON "ProductDiscountPerformance"("shopifyProductId");
CREATE INDEX "ProductDiscountPerformance_discountAnalysisId_idx" ON "ProductDiscountPerformance"("discountAnalysisId");
CREATE INDEX "Recommendation_shopId_idx" ON "Recommendation"("shopId");
CREATE INDEX "Recommendation_shopifyProductId_idx" ON "Recommendation"("shopifyProductId");
CREATE INDEX "Recommendation_isActive_idx" ON "Recommendation"("isActive");
CREATE INDEX "SyncLog_shopId_idx" ON "SyncLog"("shopId");
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");

ALTER TABLE "DiscountAnalysis" ADD CONSTRAINT "DiscountAnalysis_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductDiscountPerformance" ADD CONSTRAINT "ProductDiscountPerformance_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductDiscountPerformance" ADD CONSTRAINT "ProductDiscountPerformance_discountAnalysisId_fkey" FOREIGN KEY ("discountAnalysisId") REFERENCES "DiscountAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
