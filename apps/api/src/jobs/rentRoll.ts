import { prisma } from "../lib/prisma";
import { addDays, addRentPeriod, startOfTodayUtc } from "../lib/rentPeriod";
import { REMINDER_WINDOW_DAYS } from "../modules/reminders/service";

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;
// Guards against a runaway loop, e.g. a monthly tenancy left unbilled for years.
const MAX_NEW_CHARGES_PER_TENANCY = 24;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

// Issues the next rent charge for every active tenancy whose current period
// ends within the reminder window, and keeps rentExpiryDate pointing at the end
// of the period the tenant is in today. Safe to run any number of times: the
// (tenancyId, periodStart) unique key means a charge is never issued twice.
export async function runRentRoll() {
  const today = startOfTodayUtc();
  const billUntil = addDays(today, REMINDER_WINDOW_DAYS);
  let chargesCreated = 0;

  const tenancies = await prisma.tenancy.findMany({
    where: { status: "ACTIVE" },
    include: { rentCharges: { orderBy: { periodStart: "desc" }, take: 1 } },
  });

  for (const tenancy of tenancies) {
    let latest = tenancy.rentCharges[0];
    if (!latest) continue;

    for (let i = 0; i < MAX_NEW_CHARGES_PER_TENANCY && latest.periodEnd <= billUntil; i++) {
      const periodStart = latest.periodEnd;
      try {
        latest = await prisma.rentCharge.create({
          data: {
            tenancyId: tenancy.id,
            periodStart,
            periodEnd: addRentPeriod(periodStart, tenancy.rentFrequency),
            dueDate: periodStart,
            amount: tenancy.rentAmount,
          },
        });
        chargesCreated++;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        latest = await prisma.rentCharge.findUniqueOrThrow({
          where: { tenancyId_periodStart: { tenancyId: tenancy.id, periodStart } },
        });
      }
    }

    const current = await prisma.rentCharge.findFirst({
      where: { tenancyId: tenancy.id, periodStart: { lte: today } },
      orderBy: { periodStart: "desc" },
    });
    if (current && current.periodEnd.getTime() !== tenancy.rentExpiryDate?.getTime()) {
      await prisma.tenancy.update({
        where: { id: tenancy.id },
        data: { rentExpiryDate: current.periodEnd },
      });
    }
  }

  return { tenanciesChecked: tenancies.length, chargesCreated };
}

export function scheduleRentRoll() {
  const run = () => {
    runRentRoll()
      .then((result) => {
        if (result.chargesCreated > 0) {
          console.log(`Rent roll: issued ${result.chargesCreated} new rent charge(s)`);
        }
      })
      .catch((error: unknown) => {
        console.error("Rent roll failed", error);
      });
  };

  run();
  setInterval(run, RUN_EVERY_MS).unref();
}
