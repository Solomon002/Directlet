import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { CreateInspectionRequestInput } from "@directlet/shared";

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
      include: { _count: { select: { units: true } } },
    }),
    prisma.property.count({ where }),
  ]);

  return { properties, total, page, pageSize };
}

export async function getPublicProperty(propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, isPublic: true },
    include: { units: { orderBy: { label: "asc" } } },
  });

  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }

  return property;
}

export async function createInspectionRequest(unitId: string, input: CreateInspectionRequestInput) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, property: { isPublic: true } } });

  if (!unit) {
    throw new AppError(404, "Unit not found", "NOT_FOUND");
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
