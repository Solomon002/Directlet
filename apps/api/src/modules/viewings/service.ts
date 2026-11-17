import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { scheduledDayHasPassed } from "../../lib/viewings";

// The visitor's side of viewing requests: what they asked for, what the landlord
// answered, and the ways out. The landlord's contact details never appear here;
// they talk through the in-app messages.
export async function listMine(userId: string) {
  const rows = await prisma.inspectionRequest.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      message: true,
      preferredDate: true,
      scheduledFor: true,
      rescheduleCount: true,
      landlordNote: true,
      rentAmount: true,
      rentFrequency: true,
      createdAt: true,
      unit: {
        select: {
          id: true,
          label: true,
          rentAmount: true,
          rentFrequency: true,
          property: { select: { id: true, name: true, area: true, city: true } },
        },
      },
    },
  });

  return rows.map(({ rentAmount, rentFrequency, unit, ...row }) => {
    // The rent they were shown when they asked, against what it is now.
    const rentChanged =
      rentAmount !== null &&
      (!rentAmount.equals(unit.rentAmount) || rentFrequency !== unit.rentFrequency);
    return {
      ...row,
      unit: { id: unit.id, label: unit.label, property: unit.property },
      rent: {
        current: { amount: unit.rentAmount.toFixed(2), frequency: unit.rentFrequency },
        // Only present when it has changed since they asked.
        askedAt: rentChanged && rentAmount ? { amount: rentAmount.toFixed(2), frequency: rentFrequency } : null,
      },
      canCancel: row.status === "PENDING" || row.status === "SCHEDULED",
      canReportNoShow: row.status === "SCHEDULED" && scheduledDayHasPassed(row.scheduledFor),
    };
  });
}

async function getMine(userId: string, id: string) {
  const request = await prisma.inspectionRequest.findFirst({ where: { id, requesterId: userId } });
  if (!request) {
    throw new AppError(404, "Viewing request not found", "NOT_FOUND");
  }
  return request;
}

export async function cancel(userId: string, id: string) {
  const request = await getMine(userId, id);
  if (request.status !== "PENDING" && request.status !== "SCHEDULED") {
    throw new AppError(409, "This viewing can no longer be cancelled", "INVALID_STATUS");
  }
  await prisma.inspectionRequest.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

// The landlord agreed to a day and was not there. Recorded so it can be seen.
export async function reportLandlordNoShow(userId: string, id: string) {
  const request = await getMine(userId, id);
  if (request.status !== "SCHEDULED") {
    throw new AppError(409, "Only a scheduled viewing can be reported", "INVALID_STATUS");
  }
  if (!scheduledDayHasPassed(request.scheduledFor)) {
    throw new AppError(409, "You can report this once the viewing day has passed", "TOO_EARLY");
  }
  await prisma.inspectionRequest.update({ where: { id }, data: { status: "NO_SHOW_LANDLORD" } });
}
