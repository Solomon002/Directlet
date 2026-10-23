import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { CreatePaymentInput } from "@directlet/shared";

// Lists say whether proof exists; the file itself is only sent by getProof.
const proofSummary = { id: true, contentType: true, sizeBytes: true, createdAt: true } as const;

async function getTenancyForTenant(tenantId: string, tenancyId: string) {
  const tenancy = await prisma.tenancy.findFirst({ where: { id: tenancyId, tenantId } });
  if (!tenancy) {
    throw new AppError(404, "Tenancy not found", "NOT_FOUND");
  }
  return tenancy;
}

async function getOwnedPayment(landlordId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenancy: { unit: { property: { landlordId } } } },
  });
  if (!payment) {
    throw new AppError(404, "Payment not found", "NOT_FOUND");
  }
  return payment;
}

export async function recordPayment(tenantId: string, input: CreatePaymentInput) {
  await getTenancyForTenant(tenantId, input.tenancyId);

  return prisma.payment.create({
    data: {
      tenancyId: input.tenancyId,
      amount: input.amount,
      method: input.method,
      paidAt: input.paidAt,
      reference: input.reference,
      recordedById: tenantId,
      status: "PENDING",
    },
  });
}

export async function listForTenant(tenantId: string) {
  return prisma.payment.findMany({
    where: { tenancy: { tenantId } },
    orderBy: { createdAt: "desc" },
    include: {
      tenancy: { include: { unit: { include: { property: true } } } },
      receipt: true,
      proof: { select: proofSummary },
    },
  });
}

export async function listForLandlord(landlordId: string) {
  return prisma.payment.findMany({
    where: { tenancy: { unit: { property: { landlordId } } } },
    orderBy: { createdAt: "desc" },
    include: {
      tenancy: {
        include: {
          unit: { include: { property: true } },
          tenant: { select: { id: true, fullName: true, email: true } },
        },
      },
      receipt: true,
      proof: { select: proofSummary },
    },
  });
}

function generateReceiptNumber() {
  const stamp = new Date();
  const year = stamp.getFullYear();
  const month = String(stamp.getMonth() + 1).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `DL-${year}${month}-${suffix}`;
}

// Allocation math runs on plain numbers (safe at Naira amounts well under the
// float-precision limit); the actual stored update uses an atomic DB increment.
export async function confirmPayment(landlordId: string, paymentId: string) {
  const payment = await getOwnedPayment(landlordId, paymentId);

  if (payment.status !== "PENDING") {
    throw new AppError(409, "This payment has already been reviewed", "PAYMENT_ALREADY_REVIEWED");
  }

  const charges = await prisma.rentCharge.findMany({
    where: { tenancyId: payment.tenancyId },
    orderBy: { dueDate: "asc" },
  });

  const openCharges = charges.filter((charge) => Number(charge.amountPaid) < Number(charge.amount));

  let remaining = Number(payment.amount);
  const allocations: { rentChargeId: string; amount: number }[] = [];

  for (const charge of openCharges) {
    if (remaining <= 0) break;
    const outstanding = Number(charge.amount) - Number(charge.amountPaid);
    const applied = Math.min(remaining, outstanding);
    if (applied > 0) {
      allocations.push({ rentChargeId: charge.id, amount: applied });
      remaining -= applied;
    }
  }

  if (remaining > 0.01) {
    throw new AppError(
      409,
      "This payment is more than the tenant currently owes. Add a new rent charge before confirming it.",
      "PAYMENT_EXCEEDS_OUTSTANDING",
    );
  }

  const receiptNumber = generateReceiptNumber();

  await prisma.$transaction([
    ...allocations.map((alloc) =>
      prisma.rentCharge.update({
        where: { id: alloc.rentChargeId },
        data: { amountPaid: { increment: alloc.amount } },
      }),
    ),
    ...allocations.map((alloc) =>
      prisma.paymentAllocation.create({
        data: { paymentId: payment.id, rentChargeId: alloc.rentChargeId, amount: alloc.amount },
      }),
    ),
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "CONFIRMED", confirmedById: landlordId, confirmedAt: new Date() },
    }),
    prisma.receipt.create({
      data: { paymentId: payment.id, receiptNumber },
    }),
  ]);

  return prisma.payment.findUniqueOrThrow({
    where: { id: payment.id },
    include: { receipt: true, allocations: true },
  });
}

export async function rejectPayment(landlordId: string, paymentId: string, rejectionReason?: string) {
  const payment = await getOwnedPayment(landlordId, paymentId);

  if (payment.status !== "PENDING") {
    throw new AppError(409, "This payment has already been reviewed", "PAYMENT_ALREADY_REVIEWED");
  }

  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "REJECTED",
      confirmedById: landlordId,
      confirmedAt: new Date(),
      rejectionReason,
    },
  });
}

const MAX_PROOF_BYTES = 2 * 1024 * 1024;

// Trust the file's first bytes, not the Content-Type the browser sent.
const PROOF_SIGNATURES: { contentType: string; matches: (data: Buffer) => boolean }[] = [
  { contentType: "image/jpeg", matches: (d) => d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff },
  { contentType: "image/png", matches: (d) => d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { contentType: "image/webp", matches: (d) => d.toString("ascii", 0, 4) === "RIFF" && d.toString("ascii", 8, 12) === "WEBP" },
  { contentType: "application/pdf", matches: (d) => d.toString("ascii", 0, 5) === "%PDF-" },
];

export const PROOF_CONTENT_TYPES = PROOF_SIGNATURES.map((signature) => signature.contentType);
export const PROOF_SIZE_LIMIT = MAX_PROOF_BYTES;

export async function attachProof(tenantId: string, paymentId: string, data: Buffer) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, tenancy: { tenantId } } });
  if (!payment) {
    throw new AppError(404, "Payment not found", "NOT_FOUND");
  }
  if (payment.status !== "PENDING") {
    throw new AppError(409, "Proof can only be added while the payment is pending", "PAYMENT_ALREADY_REVIEWED");
  }

  const contentType = PROOF_SIGNATURES.find((signature) => signature.matches(data))?.contentType;
  if (!contentType) {
    throw new AppError(415, "Upload a JPG, PNG, WebP image or a PDF", "UNSUPPORTED_FILE_TYPE");
  }

  // Uploading again replaces the earlier proof. Copying into a plain
  // Uint8Array gives Prisma the ArrayBuffer-backed bytes it expects.
  const bytes = new Uint8Array(data);
  return prisma.paymentProof.upsert({
    where: { paymentId },
    create: { paymentId, contentType, sizeBytes: bytes.length, data: bytes },
    update: { contentType, sizeBytes: bytes.length, data: bytes, createdAt: new Date() },
    select: { id: true, contentType: true, sizeBytes: true, createdAt: true },
  });
}

export async function getProof(userId: string, paymentId: string) {
  const proof = await prisma.paymentProof.findFirst({
    where: {
      paymentId,
      payment: {
        OR: [
          { tenancy: { tenantId: userId } },
          { tenancy: { unit: { property: { landlordId: userId } } } },
        ],
      },
    },
  });

  if (!proof) {
    throw new AppError(404, "Proof not found", "NOT_FOUND");
  }

  return proof;
}

export async function getReceiptForDownload(userId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      OR: [
        { tenancy: { tenantId: userId } },
        { tenancy: { unit: { property: { landlordId: userId } } } },
      ],
    },
    include: {
      receipt: true,
      tenancy: { include: { unit: { include: { property: true } }, tenant: true } },
      allocations: { include: { rentCharge: true } },
    },
  });

  if (!payment || !payment.receipt) {
    throw new AppError(404, "Receipt not found", "NOT_FOUND");
  }

  return payment;
}
