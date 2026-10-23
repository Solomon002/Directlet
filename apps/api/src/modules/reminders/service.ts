import { prisma } from "../../lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { addDays, daysBetween, startOfTodayUtc } from "../../lib/rentPeriod";

// Charges due within this many days count as "due soon". The rent roll job also
// issues the next charge this far ahead, so tenants get the full notice period.
export const REMINDER_WINDOW_DAYS = 30;

export type Reminder = {
  rentChargeId: string;
  tenancyId: string;
  kind: "OVERDUE" | "DUE_SOON";
  dueDate: Date;
  // Negative when overdue.
  daysUntilDue: number;
  balance: string;
  propertyName: string;
  unitLabel: string;
  tenantName: string;
};

// Reminders are derived from unpaid rent charges on every request, never stored,
// so they can never drift from what the tenant actually owes.
async function buildReminders(where: Prisma.RentChargeWhereInput): Promise<Reminder[]> {
  const today = startOfTodayUtc();

  const charges = await prisma.rentCharge.findMany({
    where: { ...where, dueDate: { lte: addDays(today, REMINDER_WINDOW_DAYS) } },
    orderBy: { dueDate: "asc" },
    include: {
      tenancy: {
        include: {
          unit: { include: { property: true } },
          tenant: { select: { fullName: true } },
        },
      },
    },
  });

  return charges
    .map((charge) => ({ charge, balance: charge.amount.minus(charge.amountPaid) }))
    .filter(({ balance }) => balance.greaterThan(0))
    .map(({ charge, balance }): Reminder => ({
      rentChargeId: charge.id,
      tenancyId: charge.tenancyId,
      kind: charge.dueDate < today ? "OVERDUE" : "DUE_SOON",
      dueDate: charge.dueDate,
      daysUntilDue: daysBetween(today, charge.dueDate),
      balance: balance.toFixed(2),
      propertyName: charge.tenancy.unit.property.name,
      unitLabel: charge.tenancy.unit.label,
      tenantName: charge.tenancy.tenant.fullName,
    }));
}

export function remindersForTenant(tenantId: string) {
  return buildReminders({ tenancy: { tenantId, status: "ACTIVE" } });
}

// Includes ended tenancies, since a former tenant can still owe rent.
export function remindersForLandlord(landlordId: string) {
  return buildReminders({ tenancy: { unit: { property: { landlordId } } } });
}
