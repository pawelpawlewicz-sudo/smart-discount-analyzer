-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_shopId_shopifyProductId_key" ON "Recommendation"("shopId", "shopifyProductId");
