import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { Prisma } from "../../generated/prisma/client";
import type { RentFrequency } from "../../generated/prisma/enums";
import type { CreateInspectionRequestInput } from "@directlet/shared";

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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        ...publicPropertyFields,
        units: {
          select: {
            bedrooms: true,
            rentAmount: true,
            rentFrequency: true,
            _count: { select: activeTenancyCount },
          },
        },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties: properties.map(({ units, ...property }) => {
      const vacant = units.filter((unit) => unit._count.tenancies === 0);
      // The card describes what a visitor can actually rent; a fully let
      // compound falls back to all its flats.
      const shown = vacant.length > 0 ? vacant : units;
      const cheapest = shown.reduce<(typeof shown)[number] | null>(
        (best, unit) =>
          !best || yearlyRent(unit.rentAmount, unit.rentFrequency) < yearlyRent(best.rentAmount, best.rentFrequency)
            ? unit
            : best,
        null,
      );
      const bedrooms = shown.map((unit) => unit.bedrooms);
      return {
        ...property,
        unitCount: units.length,
        vacantUnitCount: vacant.length,
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
          _count: { select: activeTenancyCount },
        },
      },
    },
  });

  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }

  return {
    ...property,
    units: property.units.map(({ _count, ...unit }) => ({ ...unit, isVacant: _count.tenancies === 0 })),
  };
}

export async function createInspectionRequest(unitId: string, input: CreateInspectionRequestInput) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: publiclyVisible },
    include: { _count: { select: activeTenancyCount } },
  });

  if (!unit) {
    throw new AppError(404, "Unit not found", "NOT_FOUND");
  }

  if (unit._count.tenancies > 0) {
    throw new AppError(409, "This flat is already let. Try another vacant flat.", "UNIT_OCCUPIED");
  }

  return prisma.inspectionRequest.create({
    data: {
      unitId: unit.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      preferredDate: input.preferredDate,
    },
  });
}
