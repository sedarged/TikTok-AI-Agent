-- AlterTable
ALTER TABLE "Cache" ADD COLUMN "expiresAt" DATETIME;

-- CreateIndex
CREATE INDEX "Cache_expiresAt_idx" ON "Cache"("expiresAt");
