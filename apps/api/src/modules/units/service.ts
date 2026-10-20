import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { CreateUnitInput, UpdateUnitInput } from "@directlet/shared";

async function assertOwnsProperty(landlordId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, landlordId },
    select: { id: true },
  });

  if (!property) {
    throw new AppError(404, "Property not found", "NOT_FOUND");
  }
}

export async function listUnits(landlordId: string, propertyId: string) {
  await assertOwnsProperty(landlordId, propertyId);
  return prisma.unit.findMany({
    where: { propertyId },
    orderBy: { label: "asc" },
  });
}

export async function createUnit(landlordId: string, propertyId: string, input: CreateUnitInput) {
  await assertOwnsProperty(landlordId, propertyId);

  try {
    return await prisma.unit.create({
      data: { ...input, propertyId },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      throw new AppError(
        409,
        "A unit with this label already exists on this property",
        "UNIT_LABEL_TAKEN",
      );
    }
    throw err;
  }
}

async function getOwnedUnit(landlordId: string, propertyId: string, unitId: string) {
  await assertOwnsProperty(landlordId, propertyId);

  const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId } });
  if (!unit) {
    throw new AppError(404, "Unit not found", "NOT_FOUND");
  }
  return unit;
}

export async function updateUnit(
  landlordId: string,
  propertyId: string,
  unitId: string,
  input: UpdateUnitInput,
) {
  await getOwnedUnit(landlordId, propertyId, unitId);
  return prisma.unit.update({ where: { id: unitId }, data: input });
}

export async function deleteUnit(landlordId: string, propertyId: string, unitId: string) {
  await getOwnedUnit(landlordId, propertyId, unitId);

  try {
    await prisma.unit.delete({ where: { id: unitId } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
      throw new AppError(409, "This unit has tenancy history and cannot be deleted", "UNIT_IN_USE");
    }
    throw err;
  }
}
