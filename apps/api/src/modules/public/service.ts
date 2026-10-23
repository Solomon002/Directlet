import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
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
} as const;

const activeTenancyCount = { tenancies: { where: { status: "ACTIVE" as const } } };

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
    isPublic: true,
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
        units: { select: { _count: { select: activeTenancyCount } } },
      },
    }),
    prisma.property.count({ where }),
  ]);

  return {
    properties: properties.map(({ units, ...property }) => ({
      ...property,
      unitCount: units.length,
      vacantUnitCount: units.filter((unit) => unit._count.tenancies === 0).length,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getPublicProperty(propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, isPublic: true },
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
    where: { id: unitId, property: { isPublic: true } },
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
