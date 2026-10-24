-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "hiddenByAdminAt" TIMESTAMP(3),
ADD COLUMN     "hiddenByAdminReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "PageView" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_day_idx" ON "PageView"("day");

-- CreateIndex
CREATE INDEX "PageView_day_visitorHash_idx" ON "PageView"("day", "visitorHash");

-- Lock the table away from the Supabase web API (our API connects as the owner).
ALTER TABLE "PageView" ENABLE ROW LEVEL SECURITY;
