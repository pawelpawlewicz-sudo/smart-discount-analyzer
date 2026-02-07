-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "defaultMargin" REAL DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiscountAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "discountCode" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "totalProfit" REAL NOT NULL DEFAULT 0,
    "totalDiscount" REAL NOT NULL DEFAULT 0,
    "avgOrderValue" REAL NOT NULL DEFAULT 0,
    "conversionRate" REAL,
    "roiPercentage" REAL,
    "isProfitable" BOOLEAN NOT NULL DEFAULT false,
    "profitabilityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiscountAnalysis_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductDiscountPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "discountAnalysisId" TEXT,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productCategory" TEXT,
    "regularPrice" REAL NOT NULL,
    "costPerItem" REAL,
    "margin" REAL,
    "unitsSoldWithDiscount" INTEGER NOT NULL DEFAULT 0,
    "unitsSoldWithoutDiscount" INTEGER NOT NULL DEFAULT 0,
    "revenueWithDiscount" REAL NOT NULL DEFAULT 0,
    "revenueWithoutDiscount" REAL NOT NULL DEFAULT 0,
    "profitWithDiscount" REAL NOT NULL DEFAULT 0,
    "profitWithoutDiscount" REAL NOT NULL DEFAULT 0,
    "recommendedDiscountLevel" REAL,
    "breakevenMultiplier" REAL,
    "priceElasticity" REAL,
    "profitabilityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductDiscountPerformance_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductDiscountPerformance_discountAnalysisId_fkey" FOREIGN KEY ("discountAnalysisId") REFERENCES "DiscountAnalysis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "suggestedDiscountPercent" REAL,
    "expectedRoi" REAL,
    "confidenceLevel" REAL NOT NULL DEFAULT 0.5,
    "reasoning" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recommendation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ordersProcessed" INTEGER NOT NULL DEFAULT 0,
    "productsProcessed" INTEGER NOT NULL DEFAULT 0,
    "discountsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "SyncLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "DiscountAnalysis_shopId_idx" ON "DiscountAnalysis"("shopId");

-- CreateIndex
CREATE INDEX "DiscountAnalysis_discountCode_idx" ON "DiscountAnalysis"("discountCode");

-- CreateIndex
CREATE INDEX "ProductDiscountPerformance_shopId_idx" ON "ProductDiscountPerformance"("shopId");

-- CreateIndex
CREATE INDEX "ProductDiscountPerformance_shopifyProductId_idx" ON "ProductDiscountPerformance"("shopifyProductId");

-- CreateIndex
CREATE INDEX "ProductDiscountPerformance_discountAnalysisId_idx" ON "ProductDiscountPerformance"("discountAnalysisId");

-- CreateIndex
CREATE INDEX "Recommendation_shopId_idx" ON "Recommendation"("shopId");

-- CreateIndex
CREATE INDEX "Recommendation_shopifyProductId_idx" ON "Recommendation"("shopifyProductId");

-- CreateIndex
CREATE INDEX "Recommendation_isActive_idx" ON "Recommendation"("isActive");

-- CreateIndex
CREATE INDEX "SyncLog_shopId_idx" ON "SyncLog"("shopId");

-- CreateIndex
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
