import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { CreateComplaintInput, UpdateComplaintStatusInput } from "@directlet/shared";

async function getTenancyForTenant(tenantId: string, tenancyId: string) {
  const tenancy = await prisma.tenancy.findFirst({ where: { id: tenancyId, tenantId } });
  if (!tenancy) {
    throw new AppError(404, "Tenancy not found", "NOT_FOUND");
  }
  return tenancy;
}

async function getOwnedComplaint(landlordId: string, complaintId: string) {
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenancy: { unit: { property: { landlordId } } } },
  });
  if (!complaint) {
    throw new AppError(404, "Complaint not found", "NOT_FOUND");
  }
  return complaint;
}

export async function fileComplaint(tenantId: string, input: CreateComplaintInput) {
  await getTenancyForTenant(tenantId, input.tenancyId);

  return prisma.complaint.create({
    data: {
      tenancyId: input.tenancyId,
      raisedById: tenantId,
      title: input.title,
      description: input.description,
    },
  });
}

export async function listForTenant(tenantId: string) {
  return prisma.complaint.findMany({
    where: { tenancy: { tenantId } },
    orderBy: { createdAt: "desc" },
    include: {
      tenancy: { include: { unit: { include: { property: true } } } },
    },
  });
}

export async function listForLandlord(landlordId: string) {
  return prisma.complaint.findMany({
    where: { tenancy: { unit: { property: { landlordId } } } },
    orderBy: { createdAt: "desc" },
    include: {
      tenancy: {
        include: {
          unit: { include: { property: true } },
          tenant: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });
}

export async function updateStatus(
  landlordId: string,
  complaintId: string,
  input: UpdateComplaintStatusInput,
) {
  const complaint = await getOwnedComplaint(landlordId, complaintId);

  return prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      status: input.status,
      landlordNote: input.landlordNote,
      resolvedAt: input.status === "RESOLVED" ? new Date() : null,
    },
  });
}
