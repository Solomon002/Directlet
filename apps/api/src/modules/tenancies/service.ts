import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { addRentPeriod } from "../../lib/rentPeriod";
import type { CreateTenancyInput } from "@directlet/shared";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function getOwnedUnit(landlordId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { landlordId } },
  });

  if (!unit) {
    throw new AppError(404, "Unit not found", "NOT_FOUND");
  }

  return unit;
}

async function resolveTenant(email: string, fullName: string, phone: string | undefined) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== "TENANT") {
      throw new AppError(409, "This email belongs to a non-tenant account", "EMAIL_NOT_TENANT");
    }
    return { tenant: existing, inviteToken: null as string | null };
  }

  const inviteToken = randomUUID();

  const tenant = await prisma.user
    .create({
      data: {
        email,
        fullName: fullName.trim(),
        phone,
        role: "TENANT",
        inviteToken,
        inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "An account with this email already exists", "EMAIL_TAKEN");
      }
      throw error;
    });

  return { tenant, inviteToken };
}

export async function createTenancy(landlordId: string, input: CreateTenancyInput) {
  const unit = await getOwnedUnit(landlordId, input.unitId);

  const activeTenancy = await prisma.tenancy.findFirst({
    where: { unitId: unit.id, status: "ACTIVE" },
  });
  if (activeTenancy) {
    throw new AppError(409, "This unit already has an active tenancy", "UNIT_OCCUPIED");
  }

  const email = normalizeEmail(input.tenantEmail);
  const { tenant, inviteToken } = await resolveTenant(email, input.tenantFullName, input.tenantPhone);

  const rentExpiryDate = addRentPeriod(input.startDate, unit.rentFrequency);

  const tenancy = await prisma.tenancy
    .create({
      data: {
        unitId: unit.id,
        tenantId: tenant.id,
        rentAmount: unit.rentAmount,
        rentFrequency: unit.rentFrequency,
        startDate: input.startDate,
        rentExpiryDate,
        status: "ACTIVE",
      },
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "This unit already has an active tenancy", "UNIT_OCCUPIED");
      }
      throw error;
    });

  await prisma.rentCharge.create({
    data: {
      tenancyId: tenancy.id,
      periodStart: input.startDate,
      periodEnd: rentExpiryDate,
      dueDate: input.startDate,
      amount: unit.rentAmount,
    },
  });

  return { tenancy, tenant, inviteToken };
}

export async function listMyTenancies(landlordId: string) {
  return prisma.tenancy.findMany({
    where: { unit: { property: { landlordId } } },
    orderBy: { createdAt: "desc" },
    include: {
      unit: { include: { property: true } },
      tenant: { select: { id: true, email: true, fullName: true, phone: true } },
    },
  });
}

export async function getMyTenancy(landlordId: string, tenancyId: string) {
  const tenancy = await prisma.tenancy.findFirst({
    where: { id: tenancyId, unit: { property: { landlordId } } },
    include: {
      unit: { include: { property: true } },
      tenant: { select: { id: true, email: true, fullName: true, phone: true } },
      rentCharges: { orderBy: { periodStart: "asc" } },
    },
  });

  if (!tenancy) {
    throw new AppError(404, "Tenancy not found", "NOT_FOUND");
  }

  return tenancy;
}

export async function endTenancy(landlordId: string, tenancyId: string) {
  const tenancy = await getMyTenancy(landlordId, tenancyId);

  if (tenancy.status === "ENDED") {
    throw new AppError(409, "This tenancy has already ended", "TENANCY_ALREADY_ENDED");
  }

  return prisma.tenancy.update({
    where: { id: tenancy.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
}

export async function getMyActiveTenancyAsTenant(tenantId: string) {
  const tenancy = await prisma.tenancy.findFirst({
    where: { tenantId, status: "ACTIVE" },
    include: {
      unit: { include: { property: true } },
      rentCharges: { orderBy: { periodStart: "asc" } },
    },
  });

  if (!tenancy) {
    throw new AppError(404, "No active tenancy found", "NOT_FOUND");
  }

  return tenancy;
}
