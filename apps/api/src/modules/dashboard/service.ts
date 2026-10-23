import { prisma } from "../../lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { startOfTodayUtc } from "../../lib/rentPeriod";

const ACTIVITY_LIMIT = 50;

// Money is summed as Decimal, never as floats, so the totals match the ledger exactly.
export async function getTotals(landlordId: string) {
  const ownedTenancy = { unit: { property: { landlordId } } };
  const today = startOfTodayUtc();
  const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  const [
    collected,
    collectedThisYear,
    pendingPayments,
    charges,
    propertyCount,
    unitCount,
    activeTenancyCount,
    openComplaintCount,
    pendingInspectionCount,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { tenancy: ownedTenancy, status: "CONFIRMED" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { tenancy: ownedTenancy, status: "CONFIRMED", confirmedAt: { gte: startOfYear } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { tenancy: ownedTenancy, status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.rentCharge.findMany({
      where: { tenancy: ownedTenancy },
      select: { amount: true, amountPaid: true, dueDate: true },
    }),
    prisma.property.count({ where: { landlordId } }),
    prisma.unit.count({ where: { property: { landlordId } } }),
    prisma.tenancy.count({ where: { ...ownedTenancy, status: "ACTIVE" } }),
    prisma.complaint.count({ where: { tenancy: ownedTenancy, status: { not: "RESOLVED" } } }),
    prisma.inspectionRequest.count({
      where: { unit: { property: { landlordId } }, status: { in: ["PENDING", "SCHEDULED"] } },
    }),
  ]);

  // Outstanding is every unpaid balance already billed; overdue is the part
  // whose due date has passed.
  let outstanding = new Prisma.Decimal(0);
  let overdue = new Prisma.Decimal(0);
  for (const charge of charges) {
    const balance = charge.amount.minus(charge.amountPaid);
    if (balance.lessThanOrEqualTo(0)) continue;
    outstanding = outstanding.plus(balance);
    if (charge.dueDate < today) overdue = overdue.plus(balance);
  }

  return {
    collected: (collected._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    collectedThisYear: (collectedThisYear._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    outstanding: outstanding.toFixed(2),
    overdue: overdue.toFixed(2),
    pendingPayments: {
      count: pendingPayments._count,
      amount: (pendingPayments._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    },
    properties: propertyCount,
    units: unitCount,
    occupiedUnits: activeTenancyCount,
    vacantUnits: unitCount - activeTenancyCount,
    openComplaints: openComplaintCount,
    pendingInspections: pendingInspectionCount,
  };
}

// The landlord sees their own actions and their tenants' actions. The stored
// path is a route pattern (ids replaced with :id), so nothing sensitive leaks.
export async function listActivity(landlordId: string) {
  const tenants = await prisma.tenancy.findMany({
    where: { unit: { property: { landlordId } } },
    select: { tenantId: true },
    distinct: ["tenantId"],
  });

  return prisma.auditLog.findMany({
    where: {
      userId: { in: [landlordId, ...tenants.map((tenancy) => tenancy.tenantId)] },
      statusCode: { lt: 400 },
    },
    orderBy: { createdAt: "desc" },
    take: ACTIVITY_LIMIT,
    select: {
      id: true,
      method: true,
      path: true,
      entity: true,
      entityId: true,
      createdAt: true,
      user: { select: { id: true, fullName: true, role: true } },
    },
  });
}
