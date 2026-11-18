import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { availabilityState } from "../../lib/availability";
import { byLabel } from "../../lib/naturalOrder";
import { withAvailability } from "../units/service";
import type { CreatePropertyInput, UpdatePropertyInput } from "@directlet/shared";

export async function listMyProperties(landlordId: string) {
  const properties = await prisma.property.findMany({
    where: { landlordId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { units: true } },
      units: {
        select: {
          availabilityConfirmedAt: true,
          _count: { select: { tenancies: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });

  // Only flats with no tenant need vouching for; a let flat is not on offer.
  return properties.map(({ units, ...property }) => {
    const states = units
      .filter((unit) => unit._count.tenancies === 0)
      .map((unit) => availabilityState(unit.availabilityConfirmedAt));
    return {
      ...property,
      needsConfirmation: states.filter((state) => state === "DUE").length,
      unconfirmed: states.filter((state) => state === "STALE").length,
    };
  });
}

export async function getMyProperty(landlordId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, landlordId },
    include: {
      units: {
        orderBy: { label: "asc" },
        include: { _count: { select: { tenancies: { where: { status: "ACTIVE" } } } } },
      },
    },
  });

  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }

  return {
    ...property,
    units: [...property.units].sort(byLabel).map(({ _count, ...unit }) => ({
      ...withAvailability(unit),
      // Only a flat with no tenant needs vouching for.
      occupied: _count.tenancies > 0,
    })),
  };
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
