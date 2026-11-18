import { prisma } from "../../lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { availabilityState, daysSince } from "../../lib/availability";
import { emailEnabled } from "../../lib/email";
import { notifyLandlordOfRequest } from "../../lib/notify";
import { publicSummary, ratingsFor } from "../reviews/service";
import { byLabel } from "../../lib/naturalOrder";
import {
  MAX_ACTIVE_REQUESTS_PER_USER,
  RESTRICT_AFTER_MISSED,
  RESTRICT_WINDOW_DAYS,
  isBeforeToday,
} from "../../lib/viewings";
import type { RentFrequency } from "../../generated/prisma/enums";
import type { CreateInspectionRequestInput } from "@directlet/shared";

// What a landlord's verification shows publicly. Only an approved application counts,
// and only a company's CAC details are shown (an individual's documents never are).
const publicVerificationFields = {
  status: true,
  landlordType: true,
  cacType: true,
  cacNumber: true,
  registeredName: true,
  verifiedAt: true,
} as const;

// Only what a visitor needs. Tenant details never leave the API; a unit only
// says whether it is vacant.
const publicPropertyFields = {
  id: true,
  name: true,
  address: true,
  area: true,
  city: true,
  state: true,
  description: true,
  latitude: true,
  longitude: true,
  landlord: { select: { verification: { select: publicVerificationFields } } },
} as const;

const activeTenancyCount = { tenancies: { where: { status: "ACTIVE" as const } } };

// What the public can see: listed by the landlord, not taken down by an
// admin, and not owned by a suspended landlord. Messaging uses it too.
export const publiclyVisible = {
  isPublic: true,
  hiddenByAdminAt: null,
  landlord: { suspendedAt: null },
} satisfies Prisma.PropertyWhereInput;

const PERIODS_PER_YEAR: Record<RentFrequency, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  BIANNUAL: 2,
  ANNUAL: 1,
};

// Puts rents on one scale so "from" picks the truly cheapest flat even when
// one is billed monthly and another yearly.
function yearlyRent(amount: Prisma.Decimal, frequency: RentFrequency) {
  return Number(amount) * PERIODS_PER_YEAR[frequency];
}

type PublicVerification = {
  status: "PENDING" | "VERIFIED" | "REJECTED";
  landlordType: "INDIVIDUAL" | "COMPANY";
  cacType: "RC" | "BN" | "IT" | null;
  cacNumber: string | null;
  registeredName: string | null;
  verifiedAt: Date | null;
} | null;

function publicLandlord(verification: PublicVerification | undefined) {
  if (verification?.status !== "VERIFIED") return { verified: false as const };
  return {
    verified: true as const,
    landlordType: verification.landlordType,
    verifiedAt: verification.verifiedAt,
    ...(verification.landlordType === "COMPANY"
      ? {
          cacType: verification.cacType,
          cacNumber: verification.cacNumber,
          registeredName: verification.registeredName,
        }
      : {}),
  };
}

type UnitAvailability = "AVAILABLE" | "UNCONFIRMED" | "LET";

// A let flat is LET. A vacant flat the landlord has not vouched for in a month is
// UNCONFIRMED: shown, but not offered for viewings until they confirm again.
function unitAvailability(unit: { _count: { tenancies: number }; availabilityConfirmedAt: Date }): UnitAvailability {
  if (unit._count.tenancies > 0) return "LET";
  return availabilityState(unit.availabilityConfirmedAt) === "STALE" ? "UNCONFIRMED" : "AVAILABLE";
}

type UnitFees = {
  rentAmount: Prisma.Decimal;
  cautionDeposit: Prisma.Decimal | null;
  agreementFee: Prisma.Decimal | null;
  serviceCharge: Prisma.Decimal | null;
  agencyFee: Prisma.Decimal | null;
};

const FEE_LABELS = [
  ["cautionDeposit", "Caution deposit"],
  ["agreementFee", "Agreement fee"],
  ["serviceCharge", "Service charge"],
  ["agencyFee", "Agency fee"],
] as const;

// The visitor's real first payment: the rent plus every fee the landlord has stated.
// Fees nobody has stated are listed, so "total" is never mistaken for "everything".
function pricing(unit: UnitFees) {
  const fees = FEE_LABELS.map(([key, label]) => ({
    key,
    label,
    amount: unit[key] === null ? null : unit[key].toFixed(2),
  }));
  const stated = FEE_LABELS.reduce((sum, [key]) => sum.plus(unit[key] ?? 0), new Prisma.Decimal(0));
  return {
    fees,
    unstatedFees: fees.filter((fee) => fee.amount === null).map((fee) => fee.label),
    moveInTotal: unit.rentAmount.plus(stated).toFixed(2),
  };
}

type ListPublicPropertiesParams = {
  city?: string;
  area?: string;
  page?: number;
  pageSize?: number;
};

export async function listPublicProperties(params: ListPublicPropertiesParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 && params.pageSize <= 50 ? params.pageSize : 20;

  const where = {
    ...publiclyVisible,
    ...(params.city ? { city: { equals: params.city, mode: "insensitive" as const } } : {}),
    ...(params.area ? { area: { equals: params.area, mode: "insensitive" as const } } : {}),
  };

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      // Verified landlords first, then newest.
      orderBy: [
        { landlord: { verification: { verifiedAt: { sort: "desc", nulls: "last" } } } },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        ...publicPropertyFields,
        // Just the cover, and how many there are; the full set is on the listing page.
        photos: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
        _count: { select: { photos: true } },
        units: {
          select: {
            bedrooms: true,
            rentAmount: true,
            rentFrequency: true,
            availabilityConfirmedAt: true,
            _count: { select: activeTenancyCount },
          },
        },
      },
    }),
    prisma.property.count({ where }),
  ]);

  const ratings = await ratingsFor(properties.map((property) => property.id));

  return {
    properties: properties.map(({ units, landlord, photos, _count: propertyCounts, ...property }) => {
      const vacant = units.filter((unit) => unitAvailability(unit) === "AVAILABLE");
      // The card describes what a visitor can actually rent; a compound with
      // nothing on offer falls back to all its flats.
      const shown = vacant.length > 0 ? vacant : units;
      const cheapest = shown.reduce<(typeof shown)[number] | null>(
        (best, unit) =>
          !best || yearlyRent(unit.rentAmount, unit.rentFrequency) < yearlyRent(best.rentAmount, best.rentFrequency)
            ? unit
            : best,
        null,
      );
      const bedrooms = shown.map((unit) => unit.bedrooms);
      // When the freshest "still available" among the flats on offer was given.
      const freshest = vacant.reduce<Date | null>(
        (latest, unit) => (!latest || unit.availabilityConfirmedAt > latest ? unit.availabilityConfirmedAt : latest),
        null,
      );
      return {
        ...property,
        landlord: publicLandlord(landlord.verification),
        rating: ratings.get(property.id) ?? null,
        coverPhotoId: photos[0]?.id ?? null,
        photoCount: propertyCounts.photos,
        unitCount: units.length,
        vacantUnitCount: vacant.length,
        availabilityConfirmedAt: freshest,
        availabilityConfirmedDaysAgo: freshest ? daysSince(freshest) : null,
        bedroomsMin: bedrooms.length ? Math.min(...bedrooms) : null,
        bedroomsMax: bedrooms.length ? Math.max(...bedrooms) : null,
        priceFrom: cheapest
          ? { amount: cheapest.rentAmount.toFixed(2), frequency: cheapest.rentFrequency }
          : null,
      };
    }),
    total,
    page,
    pageSize,
  };
}

export async function getPublicProperty(propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...publiclyVisible },
    select: {
      ...publicPropertyFields,
      photos: { orderBy: { position: "asc" }, select: { id: true, unitId: true } },
      units: {
        orderBy: { label: "asc" },
        select: {
          id: true,
          label: true,
          bedrooms: true,
          bathrooms: true,
          rentAmount: true,
          rentFrequency: true,
          description: true,
          cautionDeposit: true,
          agreementFee: true,
          serviceCharge: true,
          agencyFee: true,
          availabilityConfirmedAt: true,
          availableFrom: true,
          _count: { select: activeTenancyCount },
        },
      },
    },
  });

  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }

  const { landlord, units, ...rest } = property;
  const reviews = await publicSummary(property.id);
  return {
    ...rest,
    reviews,
    landlord: publicLandlord(landlord.verification),
    units: [...units].sort(byLabel).map(({ _count, cautionDeposit, agreementFee, serviceCharge, agencyFee, ...unit }) => {
      const availability = unitAvailability({ _count, availabilityConfirmedAt: unit.availabilityConfirmedAt });
      return {
        ...unit,
        availability,
        // Kept for older callers: true only when the flat can be viewed now.
        isVacant: availability === "AVAILABLE",
        availabilityConfirmedDaysAgo: daysSince(unit.availabilityConfirmedAt),
        ...pricing({ rentAmount: unit.rentAmount, cautionDeposit, agreementFee, serviceCharge, agencyFee }),
      };
    }),
  };
}

export async function createInspectionRequest(userId: string, unitId: string, input: CreateInspectionRequestInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, emailVerifiedAt: true },
  });
  if (!user) {
    throw new AppError(401, "Sign in to request a viewing", "UNAUTHENTICATED");
  }
  // Landlords are asked to trust a stranger, so the stranger's email must be real. Only
  // enforced once emails can be sent; before that nobody could confirm.
  if (emailEnabled && !user.emailVerifiedAt) {
    throw new AppError(
      403,
      "Confirm your email first. We sent you a link: check your inbox and spam folder, or ask for a new one.",
      "EMAIL_NOT_VERIFIED",
    );
  }

  if (input.preferredDate && isBeforeToday(input.preferredDate)) {
    throw new AppError(400, "Pick today or a later date", "VALIDATION_ERROR");
  }

  // Someone who keeps booking and not turning up is held back for a while.
  const since = new Date(Date.now() - RESTRICT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const missed = await prisma.inspectionRequest.count({
    where: { requesterId: userId, status: "NO_SHOW_VISITOR", updatedAt: { gte: since } },
  });
  if (missed >= RESTRICT_AFTER_MISSED) {
    throw new AppError(
      403,
      `You have missed ${missed} viewings in the last ${RESTRICT_WINDOW_DAYS} days, so new requests are paused for now. Cancel viewings you cannot attend so landlords are not left waiting.`,
      "VIEWING_RESTRICTED",
    );
  }

  const open = await prisma.inspectionRequest.findMany({
    where: { requesterId: userId, status: { in: ["PENDING", "SCHEDULED"] } },
    select: { unitId: true },
  });
  if (open.some((request) => request.unitId === unitId)) {
    throw new AppError(409, "You already have an open viewing request for this flat", "ALREADY_REQUESTED");
  }
  if (open.length >= MAX_ACTIVE_REQUESTS_PER_USER) {
    throw new AppError(
      409,
      `You have ${MAX_ACTIVE_REQUESTS_PER_USER} open viewing requests. Finish or cancel one before asking for another.`,
      "TOO_MANY_OPEN_REQUESTS",
    );
  }

  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: publiclyVisible },
    include: {
      _count: { select: activeTenancyCount },
      property: { select: { name: true, landlord: { select: { email: true } } } },
    },
  });

  if (!unit) {
    throw new AppError(404, "Unit not found", "NOT_FOUND");
  }

  const availability = unitAvailability(unit);
  if (availability === "LET") {
    throw new AppError(409, "This flat is already let. Try another vacant flat.", "UNIT_OCCUPIED");
  }
  if (availability === "UNCONFIRMED") {
    throw new AppError(
      409,
      "The landlord has not confirmed this flat is still available. Message them to check, or try another flat.",
      "UNIT_UNCONFIRMED",
    );
  }

  const created = await prisma.inspectionRequest.create({
    data: {
      unitId: unit.id,
      requesterId: userId,
      // From the account, so the details cannot be made up. Shown to the landlord only
      // once they accept.
      name: user.fullName,
      email: user.email,
      phone: input.phone,
      message: input.message,
      preferredDate: input.preferredDate,
      // The rent as asked about, so a change afterwards can be pointed out.
      rentAmount: unit.rentAmount,
      rentFrequency: unit.rentFrequency,
    },
    select: { id: true, unitId: true, status: true, preferredDate: true, createdAt: true },
  });

  notifyLandlordOfRequest(unit.property.landlord.email, unit.property.name, unit.label);
  return created;
}
