-- CreateTable
CREATE TABLE "PropertyPhoto" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "unitId" UUID,
    "position" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyPhoto_propertyId_position_idx" ON "PropertyPhoto"("propertyId", "position");

-- CreateIndex
CREATE INDEX "PropertyPhoto_contentHash_idx" ON "PropertyPhoto"("contentHash");

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPhoto" ADD CONSTRAINT "PropertyPhoto_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lock the table away from the Supabase web API (our API connects as the owner).
ALTER TABLE "PropertyPhoto" ENABLE ROW LEVEL SECURITY;
