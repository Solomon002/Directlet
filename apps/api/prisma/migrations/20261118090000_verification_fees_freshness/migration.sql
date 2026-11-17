-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LandlordType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "CacType" AS ENUM ('RC', 'BN', 'IT');

-- CreateEnum
CREATE TYPE "VerificationDocKind" AS ENUM ('ID', 'OWNERSHIP', 'CAC_CERTIFICATE');

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "agencyFee" DECIMAL(14,2),
ADD COLUMN     "agreementFee" DECIMAL(14,2),
ADD COLUMN     "availabilityConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "availableFrom" DATE,
ADD COLUMN     "cautionDeposit" DECIMAL(14,2),
ADD COLUMN     "serviceCharge" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "LandlordVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "landlordType" "LandlordType" NOT NULL,
    "cacType" "CacType",
    "cacNumber" TEXT,
    "registeredName" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandlordVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" UUID NOT NULL,
    "verificationId" UUID NOT NULL,
    "kind" "VerificationDocKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandlordVerification_userId_key" ON "LandlordVerification"("userId");

-- CreateIndex
CREATE INDEX "LandlordVerification_status_idx" ON "LandlordVerification"("status");

-- CreateIndex
CREATE INDEX "VerificationDocument_verificationId_idx" ON "VerificationDocument"("verificationId");

-- AddForeignKey
ALTER TABLE "LandlordVerification" ADD CONSTRAINT "LandlordVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordVerification" ADD CONSTRAINT "LandlordVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "LandlordVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lock the tables away from the Supabase web API (our API connects as the owner).
ALTER TABLE "LandlordVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationDocument" ENABLE ROW LEVEL SECURITY;
