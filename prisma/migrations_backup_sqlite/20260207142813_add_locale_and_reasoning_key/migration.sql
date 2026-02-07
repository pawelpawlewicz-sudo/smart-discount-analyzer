-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN "reasoningKey" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "defaultMargin" REAL DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Shop" ("createdAt", "currency", "defaultMargin", "id", "lastSyncAt", "shopDomain", "updatedAt") SELECT "createdAt", "currency", "defaultMargin", "id", "lastSyncAt", "shopDomain", "updatedAt" FROM "Shop";
DROP TABLE "Shop";
ALTER TABLE "new_Shop" RENAME TO "Shop";
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
