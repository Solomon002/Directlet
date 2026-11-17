import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { isBeforeToday, scheduledDayHasPassed } from "../../lib/viewings";
import * as tenancyService from "../tenancies/service";
import type { InspectionStatus } from "../../generated/prisma/enums";
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

function requireStatus(inspection: { status: InspectionStatus }, allowed: InspectionStatus[], message: string) {
  if (!allowed.includes(inspection.status)) {
    throw new AppError(409, message, "INVALID_STATUS");
  }
}

// A visitor's phone and email stay private until the landlord accepts by setting a
// date. Until then (and if it is declined or cancelled) the landlord sees a name and
// can use the in-app messages. Older requests, made before accounts were needed, were
// shared with the landlord when they were sent, so they stay visible.
const CONTACT_HIDDEN_WHILE: InspectionStatus[] = ["PENDING", "DECLINED", "CANCELLED"];

export async function listForLandlord(landlordId: string) {
  const rows = await prisma.inspectionRequest.findMany({
    where: { unit: { property: { landlordId } } },
    orderBy: { createdAt: "desc" },
    include: { unit: { include: { property: true } } },
  });

  // How reliable each visitor has been across all landlords, so a landlord can tell
  // a first-timer from someone who often does not turn up.
  const requesterIds = [...new Set(rows.map((row) => row.requesterId).filter((id): id is string => id !== null))];
  const history = requesterIds.length
    ? await prisma.inspectionRequest.groupBy({
        by: ["requesterId", "status"],
        where: { requesterId: { in: requesterIds }, status: { in: ["COMPLETED", "CONVERTED", "NO_SHOW_VISITOR"] } },
        _count: true,
      })
    : [];
  const record = new Map<string, { attended: number; missed: number }>();
  for (const entry of history) {
    if (!entry.requesterId) continue;
    const current = record.get(entry.requesterId) ?? { attended: 0, missed: 0 };
    if (entry.status === "NO_SHOW_VISITOR") current.missed += entry._count;
    else current.attended += entry._count;
    record.set(entry.requesterId, current);
  }

  return rows.map(({ requesterId, ...row }) => {
    const hidden = requesterId !== null && CONTACT_HIDDEN_WHILE.includes(row.status);
    return {
      ...row,
      email: hidden ? null : row.email,
      phone: hidden ? null : row.phone,
      contactHidden: hidden,
      // Null for older requests that have no account behind them.
      visitorRecord: requesterId ? (record.get(requesterId) ?? { attended: 0, missed: 0 }) : null,
      canMarkNoShow: row.status === "SCHEDULED" && scheduledDayHasPassed(row.scheduledFor),
    };
  });
}

// Accepting (the first time) or moving the date (after that). Either way the visitor
// is told what changed, and each move is counted.
export async function scheduleInspection(
  landlordId: string,
  inspectionId: string,
  input: ScheduleInspectionInput,
) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);
  requireStatus(inspection, ["PENDING", "SCHEDULED"], "Only an open request can be given a date");

  if (isBeforeToday(input.scheduledFor)) {
    throw new AppError(400, "Pick today or a later date", "VALIDATION_ERROR");
  }

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: {
      status: "SCHEDULED",
      scheduledFor: input.scheduledFor,
      ...(inspection.status === "SCHEDULED" ? { rescheduleCount: { increment: 1 } } : {}),
    },
  });
}

export async function declineInspection(
  landlordId: string,
  inspectionId: string,
  input: DeclineInspectionInput,
) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);
  requireStatus(inspection, ["PENDING", "SCHEDULED"], "Only an open request can be declined");

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "DECLINED", landlordNote: input.landlordNote },
  });
}

export async function completeInspection(landlordId: string, inspectionId: string) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);
  requireStatus(inspection, ["SCHEDULED"], "Only a scheduled viewing can be marked complete");

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "COMPLETED" },
  });
}

// The visitor booked a viewing and did not come. Recorded against them so landlords
// can see it next time, and so repeat offenders are held back.
export async function markVisitorNoShow(landlordId: string, inspectionId: string) {
  const inspection = await getOwnedInspection(landlordId, inspectionId);
  requireStatus(inspection, ["SCHEDULED"], "Only a scheduled viewing can be marked as missed");

  if (!scheduledDayHasPassed(inspection.scheduledFor)) {
    throw new AppError(409, "You can say they did not show up once the viewing day has passed", "TOO_EARLY");
  }

  return prisma.inspectionRequest.update({
    where: { id: inspection.id },
    data: { status: "NO_SHOW_VISITOR" },
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
  requireStatus(
    inspection,
    ["PENDING", "SCHEDULED", "COMPLETED", "DECLINED"],
    "A cancelled or missed viewing cannot be turned into a tenancy",
  );

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
