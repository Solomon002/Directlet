import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { notifyLandlordOfHiddenListing } from "../../lib/notify";
import type { CreateReportInput, ResolveReportInput } from "@directlet/shared";

const PAGE_SIZE = 20;

// How many different people must report a listing before it is paused to be checked.
// A verified landlord needs more, because they have shown who they are, and because
// a few accounts ganging up on a competitor should not be enough to knock them off.
export const HIDE_AFTER_REPORTS = 3;
export const HIDE_AFTER_REPORTS_VERIFIED = 5;
// A brand-new account does not count towards that: it costs nothing to make a few.
const MIN_REPORTER_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;

const AUTO_HIDE_REASON = "Paused automatically after several reports, waiting for review";

export async function createReport(userId: string, input: CreateReportInput) {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    select: {
      id: true,
      name: true,
      landlordId: true,
      hiddenByAdminAt: true,
      landlord: { select: { fullName: true, email: true, verification: { select: { status: true } } } },
    },
  });
  if (!property) {
    throw new AppError(404, "Listing not found", "NOT_FOUND");
  }
  if (property.landlordId === userId) {
    throw new AppError(400, "You cannot report your own listing", "VALIDATION_ERROR");
  }

  const already = await prisma.report.findFirst({
    where: { reporterId: userId, propertyId: property.id, status: "OPEN" },
    select: { id: true },
  });
  if (already) {
    throw new AppError(409, "You have already reported this listing. We are looking at it.", "ALREADY_REPORTED");
  }

  const report = await prisma.report.create({
    data: { reporterId: userId, propertyId: property.id, reason: input.reason, details: input.details || null },
    select: { id: true, reason: true, status: true, createdAt: true },
  });

  // Count different, established people with an open report on this listing.
  if (!property.hiddenByAdminAt) {
    const oldEnough = new Date(Date.now() - MIN_REPORTER_ACCOUNT_AGE_MS);
    const distinct = await prisma.report.findMany({
      where: { propertyId: property.id, status: "OPEN", reporter: { createdAt: { lte: oldEnough } } },
      distinct: ["reporterId"],
      select: { reporterId: true },
    });
    const threshold =
      property.landlord.verification?.status === "VERIFIED" ? HIDE_AFTER_REPORTS_VERIFIED : HIDE_AFTER_REPORTS;

    if (distinct.length >= threshold) {
      await prisma.property.update({
        where: { id: property.id },
        data: { hiddenByAdminAt: new Date(), hiddenByAdminReason: AUTO_HIDE_REASON },
      });
      notifyLandlordOfHiddenListing(property.landlord.email, property.landlord.fullName, property.name);
    }
  }

  return report;
}

// --- Admin ---

const openFilter = { status: "OPEN" as const };

export async function listForAdmin(params: { status: "OPEN" | "HANDLED"; page: number }) {
  const where = params.status === "OPEN" ? openFilter : { status: { not: "OPEN" as const } };

  // One row per listing, most recently reported first, with all its reports inside.
  const groups = await prisma.report.groupBy({
    by: ["propertyId"],
    where,
    _count: true,
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    skip: (params.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = (await prisma.report.groupBy({ by: ["propertyId"], where })).length;

  const propertyIds = groups.map((group) => group.propertyId);
  const [properties, reports] = await Promise.all([
    prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: {
        id: true,
        name: true,
        area: true,
        city: true,
        hiddenByAdminAt: true,
        hiddenByAdminReason: true,
        landlord: {
          select: { id: true, fullName: true, email: true, suspendedAt: true, verification: { select: { status: true } } },
        },
      },
    }),
    prisma.report.findMany({
      where: { propertyId: { in: propertyIds }, ...where },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        propertyId: true,
        reason: true,
        details: true,
        status: true,
        resolutionNote: true,
        createdAt: true,
        reporter: { select: { id: true, fullName: true, createdAt: true } },
      },
    }),
  ]);

  const byId = new Map(properties.map((property) => [property.id, property]));
  return {
    groups: groups.flatMap((group) => {
      const property = byId.get(group.propertyId);
      if (!property) return [];
      const { verification, ...landlord } = property.landlord;
      return [
        {
          property: { ...property, landlord: { ...landlord, verified: verification?.status === "VERIFIED" } },
          reports: reports.filter((report) => report.propertyId === group.propertyId),
          count: group._count,
        },
      ];
    }),
    total,
    page: params.page,
    pageSize: PAGE_SIZE,
  };
}

export async function resolveForProperty(adminId: string, propertyId: string, input: ResolveReportInput) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, hiddenByAdminAt: true, hiddenByAdminReason: true },
  });
  if (!property) {
    throw new AppError(404, "Listing not found", "NOT_FOUND");
  }

  const open = await prisma.report.count({ where: { propertyId, status: "OPEN" } });
  if (open === 0) {
    throw new AppError(409, "There are no open reports on this listing", "NOTHING_TO_RESOLVE");
  }

  const handled = { handledById: adminId, handledAt: new Date(), resolutionNote: input.note || null };

  if (input.action === "TAKE_DOWN") {
    await prisma.$transaction([
      prisma.property.update({
        where: { id: propertyId },
        data: { hiddenByAdminAt: property.hiddenByAdminAt ?? new Date(), hiddenByAdminReason: input.note || "Removed after reports" },
      }),
      prisma.report.updateMany({ where: { propertyId, status: "OPEN" }, data: { status: "ACTION_TAKEN", ...handled } }),
    ]);
    return;
  }

  // Dismissed: the listing is fine. If only the automatic pause hid it, bring it back.
  await prisma.$transaction([
    prisma.report.updateMany({ where: { propertyId, status: "OPEN" }, data: { status: "DISMISSED", ...handled } }),
    ...(property.hiddenByAdminReason === AUTO_HIDE_REASON
      ? [prisma.property.update({ where: { id: propertyId }, data: { hiddenByAdminAt: null, hiddenByAdminReason: null } })]
      : []),
  ]);
}

export async function openReportListingCount() {
  return (await prisma.report.groupBy({ by: ["propertyId"], where: openFilter })).length;
}
