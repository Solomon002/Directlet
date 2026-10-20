import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { CreatePropertyInput, UpdatePropertyInput } from "@directlet/shared";

export async function listMyProperties(landlordId: string) {
  return prisma.property.findMany({
    where: { landlordId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { units: true } } },
  });
}

export async function getMyProperty(landlordId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, landlordId },
    include: { units: { orderBy: { label: "asc" } } },
  });

  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }

  return property;
}

export async function createProperty(landlordId: string, input: CreatePropertyInput) {
  return prisma.property.create({
    data: { ...input, landlordId },
  });
}

export async function updateProperty(
  landlordId: string,
  propertyId: string,
  input: UpdatePropertyInput,
) {
  await getMyProperty(landlordId, propertyId);

  return prisma.property.update({
    where: { id: propertyId },
    data: input,
  });
}

export async function deleteProperty(landlordId: string, propertyId: string) {
  await getMyProperty(landlordId, propertyId);

  try {
    await prisma.property.delete({ where: { id: propertyId } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      throw new AppError(
        409,
        "This property has units with tenancy history and cannot be deleted",
        "PROPERTY_IN_USE",
      );
    }
    throw err;
  }
}
