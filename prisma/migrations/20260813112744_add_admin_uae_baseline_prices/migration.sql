-- AlterTable
ALTER TABLE "Sku" ADD COLUMN     "baselineCurrency" TEXT,
ADD COLUMN     "baselineMaxPrice" DECIMAL(65,30),
ADD COLUMN     "baselineMinPrice" DECIMAL(65,30),
ADD COLUMN     "baselineNote" TEXT,
ADD COLUMN     "baselineUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "baselineUpdatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_baselineUpdatedById_fkey" FOREIGN KEY ("baselineUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
