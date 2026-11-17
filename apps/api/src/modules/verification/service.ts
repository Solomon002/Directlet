import { prisma } from "../../lib/prisma";
import { detectContentType } from "../../lib/fileTypes";
import { AppError } from "../../utils/AppError";
import type { Prisma } from "../../generated/prisma/client";
import type { VerificationDocKind, VerificationStatus } from "../../generated/prisma/enums";
import type { SubmitVerificationInput } from "@directlet/shared";

export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
const MAX_DOCUMENTS_PER_KIND = 3;
const PAGE_SIZE = 25;

// The listing never carries the file itself; only a download does.
const documentSummary = { id: true, kind: true, fileName: true, contentType: true, sizeBytes: true, createdAt: true } as const;

// What an admin needs to see before approving: an ID, proof the person may rent the
// property out, and for a company its CAC certificate.
function requiredKinds(landlordType: "INDIVIDUAL" | "COMPANY"): VerificationDocKind[] {
  return landlordType === "COMPANY" ? ["ID", "OWNERSHIP", "CAC_CERTIFICATE"] : ["ID", "OWNERSHIP"];
}

function withMissing<T extends { landlordType: "INDIVIDUAL" | "COMPANY"; documents: { kind: VerificationDocKind }[] }>(
  verification: T,
) {
  const have = new Set(verification.documents.map((document) => document.kind));
  return { ...verification, missingDocuments: requiredKinds(verification.landlordType).filter((kind) => !have.has(kind)) };
}

const ownFields = {
  id: true,
  status: true,
  landlordType: true,
  cacType: true,
  cacNumber: true,
  registeredName: true,
  submittedAt: true,
  reviewedAt: true,
  verifiedAt: true,
  rejectionReason: true,
  documents: { orderBy: { createdAt: "asc" as const }, select: documentSummary },
} satisfies Prisma.LandlordVerificationSelect;

export async function getMine(userId: string) {
  const verification = await prisma.landlordVerification.findUnique({ where: { userId }, select: ownFields });
  return verification ? withMissing(verification) : null;
}

export async function submit(userId: string, input: SubmitVerificationInput) {
  const existing = await prisma.landlordVerification.findUnique({ where: { userId } });
  if (existing?.status === "VERIFIED") {
    throw new AppError(409, "You are already verified", "ALREADY_VERIFIED");
  }

  const isCompany = input.landlordType === "COMPANY";

  // One registration cannot back two accounts. This stops someone borrowing a real
  // company's number to look legitimate.
  if (isCompany && input.cacType && input.cacNumber) {
    const taken = await prisma.landlordVerification.findFirst({
      where: {
        cacType: input.cacType,
        cacNumber: input.cacNumber,
        userId: { not: userId },
        status: { in: ["PENDING", "VERIFIED"] },
      },
      select: { id: true },
    });
    if (taken) {
      throw new AppError(
        409,
        "This CAC number is already linked to another account. If it is yours, contact support.",
        "CAC_NUMBER_IN_USE",
      );
    }
  }

  const data = {
    landlordType: input.landlordType,
    cacType: isCompany ? (input.cacType ?? null) : null,
    cacNumber: isCompany ? (input.cacNumber ?? null) : null,
    registeredName: isCompany ? (input.registeredName ?? null) : null,
    // Sending it again after a rejection puts it back in the queue.
    status: "PENDING" as const,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedById: null,
    rejectionReason: null,
  };

  const verification = await prisma.landlordVerification.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: ownFields,
  });
  return withMissing(verification);
}

async function getEditable(userId: string) {
  const verification = await prisma.landlordVerification.findUnique({ where: { userId } });
  if (!verification) {
    throw new AppError(409, "Fill in your details first, then add documents", "NO_APPLICATION");
  }
  if (verification.status === "VERIFIED") {
    throw new AppError(409, "You are already verified", "ALREADY_VERIFIED");
  }
  return verification;
}

export async function addDocument(userId: string, kind: VerificationDocKind, fileName: string, data: Buffer) {
  const verification = await getEditable(userId);

  const contentType = detectContentType(data);
  if (!contentType) {
    throw new AppError(415, "Upload a JPG, PNG, WebP image or a PDF", "UNSUPPORTED_FILE_TYPE");
  }

  const count = await prisma.verificationDocument.count({ where: { verificationId: verification.id, kind } });
  if (count >= MAX_DOCUMENTS_PER_KIND) {
    throw new AppError(409, `You can add up to ${MAX_DOCUMENTS_PER_KIND} files of this kind. Remove one first.`, "TOO_MANY_DOCUMENTS");
  }

  // Copying into a plain Uint8Array gives Prisma the ArrayBuffer-backed bytes it expects.
  // New files do not change the status: after a rejection the landlord sends the
  // application again themselves, so a half-finished edit is never reviewed.
  const bytes = new Uint8Array(data);
  return prisma.verificationDocument.create({
    data: {
      verificationId: verification.id,
      kind,
      fileName: cleanFileName(fileName),
      contentType,
      sizeBytes: bytes.length,
      data: bytes,
    },
    select: documentSummary,
  });
}

// Only the file's own name, never a path, and nothing that could break a header.
function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ()]/g, "").trim().slice(0, 100);
  return cleaned || "document";
}

export async function removeDocument(userId: string, documentId: string) {
  const verification = await getEditable(userId);
  const { count } = await prisma.verificationDocument.deleteMany({
    where: { id: documentId, verificationId: verification.id },
  });
  if (count === 0) {
    throw new AppError(404, "Document not found", "NOT_FOUND");
  }
}

// The landlord who uploaded it, or an admin.
export async function getDocument(user: { sub: string; role: string }, documentId: string) {
  const document = await prisma.verificationDocument.findFirst({
    where: {
      id: documentId,
      ...(user.role === "ADMIN" ? {} : { verification: { userId: user.sub } }),
    },
  });
  if (!document) {
    throw new AppError(404, "Document not found", "NOT_FOUND");
  }
  return document;
}

// --- Admin ---

export async function listForAdmin(params: { status?: VerificationStatus; page: number }) {
  const where: Prisma.LandlordVerificationWhereInput = params.status ? { status: params.status } : {};
  const [rows, total, pending] = await Promise.all([
    prisma.landlordVerification.findMany({
      where,
      // Oldest first for the queue, so nobody waits forever.
      orderBy: { submittedAt: params.status === "PENDING" ? "asc" : "desc" },
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        landlordType: true,
        cacType: true,
        cacNumber: true,
        registeredName: true,
        submittedAt: true,
        user: { select: { id: true, fullName: true, email: true } },
        documents: { select: { kind: true } },
      },
    }),
    prisma.landlordVerification.count({ where }),
    prisma.landlordVerification.count({ where: { status: "PENDING" } }),
  ]);

  return {
    verifications: rows.map((row) => {
      const { documents, ...rest } = withMissing(row);
      return { ...rest, documentCount: documents.length };
    }),
    total,
    pending,
    page: params.page,
    pageSize: PAGE_SIZE,
  };
}

export async function getForAdmin(id: string) {
  const verification = await prisma.landlordVerification.findUnique({
    where: { id },
    select: {
      ...ownFields,
      reviewer: { select: { fullName: true } },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          createdAt: true,
          _count: { select: { properties: true } },
        },
      },
    },
  });
  if (!verification) {
    throw new AppError(404, "Application not found", "NOT_FOUND");
  }
  return withMissing(verification);
}

export async function approve(adminId: string, id: string) {
  const verification = await getForAdmin(id);
  if (verification.missingDocuments.length > 0) {
    throw new AppError(
      409,
      `Missing documents: ${verification.missingDocuments.join(", ")}. Ask the landlord to add them, or reject.`,
      "MISSING_DOCUMENTS",
    );
  }
  const now = new Date();
  await prisma.landlordVerification.update({
    where: { id },
    data: { status: "VERIFIED", reviewedAt: now, verifiedAt: now, reviewedById: adminId, rejectionReason: null },
  });
}

// Also used to take verification back from a landlord who was approved by mistake.
export async function reject(adminId: string, id: string, reason: string) {
  await getForAdmin(id);
  await prisma.landlordVerification.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date(), verifiedAt: null, reviewedById: adminId, rejectionReason: reason },
  });
}
