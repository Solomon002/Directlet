-- AlterEnum
ALTER TYPE "InspectionStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "InspectionStatus" ADD VALUE 'NO_SHOW_VISITOR';
ALTER TYPE "InspectionStatus" ADD VALUE 'NO_SHOW_LANDLORD';

-- AlterTable
ALTER TABLE "InspectionRequest" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "rentAmount" DECIMAL(14,2),
ADD COLUMN     "rentFrequency" "RentFrequency",
ADD COLUMN     "requesterId" UUID,
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "InspectionRequest_requesterId_idx" ON "InspectionRequest"("requesterId");

-- AddForeignKey
ALTER TABLE "InspectionRequest" ADD CONSTRAINT "InspectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
