import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import * as tenancyService from "../tenancies/service";
import type {
  ScheduleInspectionInput,
  DeclineInspectionInput,
  ConvertInspectionInput,
} from "@directlet/shared";

async function getOwnedInspection(landlordId: string, inspectionId: string) {
  const inspection = await prisma.inspectionRequest.findFirst({
    where: { id: inspectionId, unit: { property: { landlordId } } },
  });

  if (!inspection) {
    throw new AppError(404, "Inspection request not found", "NOT_FOUND");
  }

  return inspection;
}

export async function listForLandlord(landlordId: string) {
  return prisma.inspectionRequest.findMany({
    where: { unit: { property: { landlordId } } },
    orderBy: { createdAt: "desc" },
    include: { unit: { include: { property: true } } },
  });
}

export async function scheduleInspection(
  landlordId: string,
  inspectionId: string,
  input: ScheduleInspectionInput,
) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "SCHEDULED", scheduledFor: input.scheduledFor },
  });
}

export async function declineInspection(
  landlordId: string,
  inspectionId: string,
  input: DeclineInspectionInput,
) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "DECLINED", landlordNote: input.landlordNote },
  });
}

export async function completeInspection(landlordId: string, inspectionId: string) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "COMPLETED" },
  });
}

export async function convertToTenancy(
  landlordId: string,
  inspectionId: string,
  input: ConvertInspectionInput,
) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);

  if (inspection.status === "CONVERTED") {
    throw new AppError(409, "This inspection request has already been converted", "ALREADY_CONVERTED");
  }

  const result = await tenancyService.createTenancy(landlordId, {
    unitId: inspection.unitId,
    tenantEmail: input.tenantEmail,
    tenantFullName: input.tenantFullName,
    tenantPhone: input.tenantPhone,
    startDate: input.startDate,
  });

  await prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "CONVERTED", convertedTenancyId: result.tenancy.id },
  });

  return result;
}
