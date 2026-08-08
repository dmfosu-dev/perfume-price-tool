-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'intermediary',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedById" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "sizeMl" INTEGER NOT NULL,
    "concentration" TEXT NOT NULL,
    "singlePrice" DECIMAL(65,30),
    "cartonPrice" DECIMAL(65,30),
    "cartonQty" INTEGER,
    "minimumOrderQty" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priceCurrency" TEXT,
    "stockStatus" TEXT NOT NULL DEFAULT 'unknown',
    "photoUrl" TEXT,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "priorityNote" TEXT,
    "prioritySetAt" TIMESTAMP(3),
    "prioritySetById" TEXT,
    "localStockQty" INTEGER,
    "localStockUpdatedAt" TIMESTAMP(3),
    "localStockUpdatedById" TEXT,
    "lastUpdatedAt" TIMESTAMP(3),
    "lastUpdatedById" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastVerifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "singlePrice" DECIMAL(65,30),
    "cartonPrice" DECIMAL(65,30),
    "cartonQty" INTEGER,
    "minimumOrderQty" INTEGER,
    "priceCurrency" TEXT,
    "fxBaseCurrency" TEXT,
    "fxRateToBase" DECIMAL(65,30),
    "stockStatus" TEXT NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'price_change',
    "vendorId" TEXT,
    "receiptImageUrl" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'online',

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceConflict" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "incomingSinglePrice" DECIMAL(65,30),
    "incomingCartonPrice" DECIMAL(65,30),
    "incomingCartonQty" INTEGER,
    "incomingMinimumOrderQty" INTEGER,
    "incomingPriceCurrency" TEXT,
    "incomingStockStatus" TEXT NOT NULL,
    "incomingById" TEXT NOT NULL,
    "incomingAt" TIMESTAMP(3) NOT NULL,
    "baseUpdatedAt" TIMESTAMP(3),
    "existingSinglePrice" DECIMAL(65,30),
    "existingCartonPrice" DECIMAL(65,30),
    "existingCartonQty" INTEGER,
    "existingMinimumOrderQty" INTEGER,
    "existingPriceCurrency" TEXT,
    "existingStockStatus" TEXT NOT NULL,
    "existingById" TEXT,
    "existingAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscrepancyReport" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reportedById" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "DiscrepancyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPrice" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "skuId" TEXT,
    "competitor" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAssumption" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "shippingPerUnitSar" DECIMAL(65,30),
    "shippingPerKgSar" DECIMAL(65,30),
    "customsRatePct" DECIMAL(65,30),
    "otherFeesSar" DECIMAL(65,30),
    "targetMarginPct" DECIMAL(65,30),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "source" TEXT NOT NULL DEFAULT 'exchangerate_api',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "priceEntryCurrency" TEXT NOT NULL DEFAULT 'SAR',
    "selectedCurrencies" TEXT NOT NULL DEFAULT '["USD","SAR","GHS","AED"]',
    "refreshIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "lastFetchAt" TIMESTAMP(3),
    "lastFetchError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "FxSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "currency" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById" TEXT,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_sortOrder_idx" ON "Brand"("sortOrder");

-- CreateIndex
CREATE INDEX "Variant_brandId_idx" ON "Variant"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_brandId_name_key" ON "Variant"("brandId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_skuCode_key" ON "Sku"("skuCode");

-- CreateIndex
CREATE INDEX "Sku_variantId_idx" ON "Sku"("variantId");

-- CreateIndex
CREATE INDEX "Sku_lastUpdatedAt_idx" ON "Sku"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX "Sku_isPriority_idx" ON "Sku"("isPriority");

-- CreateIndex
CREATE INDEX "Sku_stockStatus_idx" ON "Sku"("stockStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_variantId_sizeMl_concentration_key" ON "Sku"("variantId", "sizeMl", "concentration");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_isActive_idx" ON "Vendor"("isActive");

-- CreateIndex
CREATE INDEX "PriceHistory_skuId_changedAt_idx" ON "PriceHistory"("skuId", "changedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_changedAt_idx" ON "PriceHistory"("changedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_entryType_idx" ON "PriceHistory"("entryType");

-- CreateIndex
CREATE INDEX "PriceHistory_vendorId_idx" ON "PriceHistory"("vendorId");

-- CreateIndex
CREATE INDEX "PriceConflict_status_idx" ON "PriceConflict"("status");

-- CreateIndex
CREATE INDEX "PriceConflict_skuId_idx" ON "PriceConflict"("skuId");

-- CreateIndex
CREATE INDEX "DiscrepancyReport_status_idx" ON "DiscrepancyReport"("status");

-- CreateIndex
CREATE INDEX "DiscrepancyReport_skuId_idx" ON "DiscrepancyReport"("skuId");

-- CreateIndex
CREATE INDEX "CompetitorPrice_variantId_observedAt_idx" ON "CompetitorPrice"("variantId", "observedAt");

-- CreateIndex
CREATE INDEX "CompetitorPrice_competitor_idx" ON "CompetitorPrice"("competitor");

-- CreateIndex
CREATE INDEX "CostAssumption_effectiveFrom_idx" ON "CostAssumption"("effectiveFrom");

-- CreateIndex
CREATE INDEX "FxRate_baseCurrency_currency_fetchedAt_idx" ON "FxRate"("baseCurrency", "currency", "fetchedAt");

-- CreateIndex
CREATE INDEX "FxRate_fetchedAt_idx" ON "FxRate"("fetchedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_lastVerifiedById_fkey" FOREIGN KEY ("lastVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_prioritySetById_fkey" FOREIGN KEY ("prioritySetById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_localStockUpdatedById_fkey" FOREIGN KEY ("localStockUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceConflict" ADD CONSTRAINT "PriceConflict_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceConflict" ADD CONSTRAINT "PriceConflict_incomingById_fkey" FOREIGN KEY ("incomingById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceConflict" ADD CONSTRAINT "PriceConflict_existingById_fkey" FOREIGN KEY ("existingById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceConflict" ADD CONSTRAINT "PriceConflict_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscrepancyReport" ADD CONSTRAINT "DiscrepancyReport_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscrepancyReport" ADD CONSTRAINT "DiscrepancyReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscrepancyReport" ADD CONSTRAINT "DiscrepancyReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPrice" ADD CONSTRAINT "CompetitorPrice_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAssumption" ADD CONSTRAINT "CostAssumption_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxSetting" ADD CONSTRAINT "FxSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
